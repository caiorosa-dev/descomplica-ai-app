import type { Prisma, PrismaClient, StageRun } from '@app/db';
import {
  isPipelineError,
  PipelineError,
  type RunTotals,
  STAGES_BY_NAME,
  type StageContext,
  type StageEventSink,
} from '@app/pipeline';
import { parsePipelineConfig, STAGE_ORDER, type StageError, type StageName, type StageWarning } from '@app/shared';
import type { AiOverrides } from '../app';
import type { Env } from '../env';
import type { FileStorage } from '../storage/file-storage';
import { createCallRecorder } from './adapters/call-recorder';
import { createEmbedder, defaultEmbedMany } from './adapters/embedder';
import { createModelResolver } from './adapters/model-resolver';
import type { EventBus } from './event-bus';
import { createEventRecorder, type RunEventRecorder } from './event-recorder';
import { loadStageOutputs, type StageOutputs } from './persistence/load-outputs';
import { materializeStageOutput } from './persistence/materialize';
import { buildStageInput } from './stage-inputs';

const json = (value: unknown) => value as Prisma.InputJsonValue;

function toStageError(error: unknown, signal: AbortSignal): StageError {
  const e = signal.aborted
    ? new PipelineError('CANCELLED', 'Run cancelled')
    : isPipelineError(error)
      ? error
      : new PipelineError('INTERNAL_ERROR', error instanceof Error ? error.message : String(error));
  return { code: e.code, message: e.message, userMessage: e.userMessage };
}

/** Short per-stage metrics for `stage.completed`, plus the stage's tokens and cost. */
function summarizeMetrics(stage: StageName, output: unknown): Record<string, unknown> {
  const o = output as Record<string, never> & StageOutputs[StageName];
  switch (stage) {
    case 'text_extraction': {
      const t = o as StageOutputs['text_extraction'];
      return { words: t.stats.words, pages: t.stats.pages };
    }
    case 'information_extraction': {
      const i = o as StageOutputs['information_extraction'];
      return {
        facts: i.facts.length,
        confirmed: i.facts.filter((f) => f.status === 'confirmed').length,
        uncertain: i.facts.filter((f) => f.status === 'uncertain').length,
      };
    }
    case 'summarization': {
      const s = o as StageOutputs['summarization'];
      return { readabilitySummary: s.readability.summary, compressionRatio: s.compressionRatio };
    }
    case 'similarity':
      return { alignmentF1: (o as StageOutputs['similarity']).metrics.alignmentF1 };
    case 'verification': {
      const v = o as StageOutputs['verification'];
      return { alerts: v.alerts.length, factualConsistency: v.metrics.factualConsistency };
    }
    case 'report':
      return { costUsd: (o as StageOutputs['report']).costUsd };
  }
}

async function stageUsage(prisma: PrismaClient, stageRunId: string) {
  const [llm, emb] = await Promise.all([
    prisma.llmCall.aggregate({ where: { stageRunId }, _sum: { inputTokens: true, outputTokens: true, costUsd: true } }),
    prisma.embeddingCall.aggregate({ where: { stageRunId }, _sum: { tokens: true, costUsd: true } }),
  ]);
  return {
    inputTokens: (llm._sum.inputTokens ?? 0) + (emb._sum.tokens ?? 0),
    outputTokens: llm._sum.outputTokens ?? 0,
    costUsd: (llm._sum.costUsd ?? 0) + (emb._sum.costUsd ?? 0),
  };
}

export async function runUsage(prisma: PrismaClient, runId: string) {
  const [llm, emb] = await Promise.all([
    prisma.llmCall.aggregate({ where: { runId }, _sum: { inputTokens: true, outputTokens: true, costUsd: true } }),
    prisma.embeddingCall.aggregate({ where: { runId }, _sum: { tokens: true, costUsd: true } }),
  ]);
  return {
    inputTokens: (llm._sum.inputTokens ?? 0) + (emb._sum.tokens ?? 0),
    outputTokens: llm._sum.outputTokens ?? 0,
    costUsd: (llm._sum.costUsd ?? 0) + (emb._sum.costUsd ?? 0),
  };
}

export function createPipelineRunner(deps: {
  prisma: PrismaClient;
  env: Env;
  bus: EventBus;
  storage: FileStorage;
  ai?: AiOverrides;
}) {
  const { prisma, env } = deps;
  const models = deps.ai?.modelResolver ?? createModelResolver(env);
  const embedMany = deps.ai?.embedManyFn ?? defaultEmbedMany(env);

  function stageContext(
    run: { id: string; config: unknown },
    sr: StageRun,
    events: RunEventRecorder,
    warnings: StageWarning[],
    signal: AbortSignal,
  ): StageContext {
    const stage = sr.stage as StageName;
    const recorder = createCallRecorder({
      prisma,
      runId: run.id,
      getStageRunId: () => sr.id,
      onLlmCall: (row) =>
        void events.emit({
          type: 'llm.call',
          runId: run.id,
          stage,
          callId: row.id,
          agent: row.agent,
          model: row.model,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          costUsd: row.costUsd,
          latencyMs: row.latencyMs,
          status: row.status,
        }),
    });
    const sink: StageEventSink = {
      progress: (message, current, total) =>
        void events.emit({ type: 'stage.progress', runId: run.id, stage, message, current, total }),
      log: (level, message, data) => void events.emit({ type: 'log', runId: run.id, stage, level, message, data }),
      warn: (code, message) => {
        warnings.push({ code, message });
        void events.emit({ type: 'log', runId: run.id, stage, level: 'warn', message, data: { code } });
      },
    };
    return {
      runId: run.id,
      config: parsePipelineConfig(run.config),
      models,
      embedder: createEmbedder({ prisma, embedMany, onCall: (r) => recorder.recordEmbeddingCall(r) }),
      recorder,
      events: sink,
      signal,
      llmConcurrency: env.LLM_CONCURRENCY,
    };
  }

  /** Runs the pending stages of a run in order, checkpointing each one (spec §7). */
  async function execute(runId: string, signal: AbortSignal): Promise<void> {
    const events = await createEventRecorder(prisma, deps.bus, runId);
    const run = await prisma.run.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date() },
      include: { document: true, stageRuns: true },
    });
    await events.emit({ type: 'run.status', runId, stage: null, status: 'running' });
    let current: StageRun | undefined;
    let stageStarted = 0;
    try {
      const outputs = await loadStageOutputs(prisma, runId);
      const buffer = new Uint8Array(await deps.storage.read(run.document.storagePath));
      for (const stage of STAGE_ORDER) {
        const sr = run.stageRuns.find((s) => s.stage === stage);
        if (!sr) throw new PipelineError('INTERNAL_ERROR', `Run ${runId} has no stage run for ${stage}`);
        if (sr.status === 'reused') {
          await events.emit({ type: 'stage.reused', runId, stage, fromStageRunId: sr.reusedFromStageRunId ?? sr.id });
          continue;
        }
        if (sr.status === 'overridden' || sr.status === 'completed') continue;
        if (signal.aborted) throw new PipelineError('CANCELLED', 'Run cancelled');

        current = sr;
        stageStarted = Date.now();
        await prisma.stageRun.update({ where: { id: sr.id }, data: { status: 'running', error: undefined } });
        await events.emit({ type: 'stage.started', runId, stage });
        const warnings: StageWarning[] = [];
        const ctx = stageContext(run, sr, events, warnings, signal);
        const usage = await runUsage(prisma, runId);
        const totals: RunTotals = { ...usage, durationMs: Date.now() - (run.startedAt?.getTime() ?? Date.now()) };
        const definition = STAGES_BY_NAME[stage];
        const output = definition.output.parse(
          await definition.run(
            buildStageInput(stage, outputs, { buffer, filename: run.document.filename, totals }),
            ctx,
          ),
        );
        const durationMs = Date.now() - stageStarted;
        const metrics = { ...summarizeMetrics(stage, output), ...(await stageUsage(prisma, sr.id)) };
        await prisma.$transaction(async (tx) => {
          await tx.stageRun.update({
            where: { id: sr.id },
            data: {
              status: 'completed',
              output: json(output),
              metrics: json(metrics),
              warnings: json(warnings),
              durationMs,
            },
          });
          await materializeStageOutput(tx, { runId, stageRunId: sr.id, stage, output });
        });
        await events.emit({ type: 'stage.completed', runId, stage, durationMs, metrics });
        (outputs as Record<StageName, unknown>)[stage] = output;
        current = undefined;
      }
      await prisma.run.update({ where: { id: runId }, data: { status: 'completed', finishedAt: new Date() } });
      await events.emit({ type: 'run.status', runId, stage: null, status: 'completed' });
    } catch (error) {
      const stageError = toStageError(error, signal);
      const status = stageError.code === 'CANCELLED' ? 'cancelled' : 'failed';
      if (current) {
        await prisma.stageRun.update({
          where: { id: current.id },
          data: { status: 'failed', error: json(stageError), durationMs: Date.now() - stageStarted },
        });
        await events.emit({ type: 'stage.failed', runId, stage: current.stage as StageName, error: stageError });
      }
      await prisma.run.update({
        where: { id: runId },
        data: { status, error: json(stageError), finishedAt: new Date() },
      });
      await events.emit({ type: 'run.status', runId, stage: null, status });
    }
  }

  return { execute };
}

/** On API start, runs left queued or running are marked interrupted, and their running stage as failed. */
export async function markInterruptedRuns(prisma: PrismaClient): Promise<number> {
  const interrupted = new PipelineError('INTERRUPTED', 'API restarted during the run');
  const error = { code: interrupted.code, message: interrupted.message, userMessage: interrupted.userMessage };
  return prisma.$transaction(async (tx) => {
    const runs = await tx.run.findMany({ where: { status: { in: ['queued', 'running'] } }, select: { id: true } });
    const ids = runs.map((r) => r.id);
    if (ids.length === 0) return 0;
    await tx.stageRun.updateMany({
      where: { runId: { in: ids }, status: 'running' },
      data: { status: 'failed', error },
    });
    await tx.run.updateMany({
      where: { id: { in: ids } },
      data: { status: 'interrupted', error, finishedAt: new Date() },
    });
    return ids.length;
  });
}

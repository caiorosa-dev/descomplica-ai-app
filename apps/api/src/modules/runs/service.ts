import type { Prisma, PrismaClient, Run, StageRun } from '@app/db';
import { PipelineError } from '@app/pipeline';
import {
  type DeepPartial,
  InjectedFault,
  mergeConfig,
  type PipelineConfig,
  parsePipelineConfig,
  type RunDto,
  requiredProviders,
  STAGE_ORDER,
  StageError,
  type StageRunDto,
  StageWarning,
  TERMINAL_RUN_STATUSES,
} from '@app/shared';
import { z } from 'zod';
import type { Env } from '../../env';
import { HttpError, notFound } from '../../http-error';
import { availableProviders } from '../../runtime/adapters/model-resolver';
import { configHash } from '../../runtime/canonical-json';
import { runUsage } from '../../runtime/pipeline-runner';
import type { RunQueue } from '../../runtime/run-queue';

const parseOr = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
  const r = schema.safeParse(value);
  return r.success ? r.data : fallback;
};

export function toStageRunDto(sr: StageRun): StageRunDto {
  return {
    id: sr.id,
    stage: sr.stage,
    status: sr.status,
    reusedFromStageRunId: sr.reusedFromStageRunId,
    durationMs: sr.durationMs,
    metrics: sr.metrics,
    warnings: parseOr(z.array(StageWarning), sr.warnings, []),
    error: parseOr(StageError.nullable(), sr.error, null),
  };
}

export async function toRunDto(prisma: PrismaClient, run: Run & { stageRuns: StageRun[] }): Promise<RunDto> {
  const stages = [...run.stageRuns].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  return {
    id: run.id,
    documentId: run.documentId,
    presetId: run.presetId,
    parentRunId: run.parentRunId,
    startFromStage: run.startFromStage,
    label: run.label,
    status: run.status,
    config: parsePipelineConfig(run.config),
    configHash: run.configHash,
    injectedFaults: parseOr(z.array(InjectedFault).nullable(), run.injectedFaults, null),
    error: parseOr(StageError.nullable(), run.error, null),
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    stages: stages.map(toStageRunDto),
    totals: await runUsage(prisma, run.id),
  };
}

export function assertProvidersConfigured(config: PipelineConfig, env: Env): void {
  const available = new Set(availableProviders(env));
  const missing = [...requiredProviders(config)].filter((p) => !available.has(p));
  if (missing.length > 0)
    throw new PipelineError('PROVIDER_NOT_CONFIGURED', `Missing API keys for: ${missing.join(', ')}`, { missing });
}

export function createRunsService(deps: { prisma: PrismaClient; env: Env; queue: RunQueue }) {
  const { prisma } = deps;
  const include = { stageRuns: true } as const;

  async function getRun(id: string) {
    const run = await prisma.run.findUnique({ where: { id }, include });
    if (!run) throw notFound('Execução');
    return run;
  }

  return {
    getRun,
    get: async (id: string) => toRunDto(prisma, await getRun(id)),

    async list(filter: { documentId?: string; label?: string }) {
      const runs = await prisma.run.findMany({
        where: { documentId: filter.documentId, label: filter.label },
        orderBy: { createdAt: 'desc' },
        include,
      });
      return Promise.all(runs.map((r) => toRunDto(prisma, r)));
    },

    /** Validates config and provider keys before anything is written, then queues the run (spec §8, Review Focus 4). */
    async create(body: {
      documentId: string;
      presetId: string;
      configOverrides?: DeepPartial<PipelineConfig>;
      label?: string;
    }) {
      const document = await prisma.document.findUnique({ where: { id: body.documentId }, select: { id: true } });
      if (!document) throw notFound('Documento');
      const preset = await prisma.preset.findUnique({ where: { id: body.presetId } });
      if (!preset) throw notFound('Preset');
      const config = mergeConfig(parsePipelineConfig(preset.config), body.configOverrides ?? {});
      assertProvidersConfigured(config, deps.env);
      const run = await prisma.run.create({
        data: {
          documentId: document.id,
          presetId: preset.id,
          label: body.label ?? null,
          status: 'queued',
          config: config as Prisma.InputJsonValue,
          configHash: configHash(config),
          stageRuns: { create: STAGE_ORDER.map((stage) => ({ stage, status: 'pending' as const })) },
        },
        include,
      });
      deps.queue.enqueue(run.id);
      return toRunDto(prisma, run);
    },

    async cancel(id: string) {
      const run = await getRun(id);
      if (TERMINAL_RUN_STATUSES.includes(run.status) || !deps.queue.cancel(id))
        throw new HttpError(409, 'RUN_NOT_ACTIVE', 'A execução não está em andamento.');
      return toRunDto(prisma, run);
    },
  };
}

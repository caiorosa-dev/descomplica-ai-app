import type { Prisma, PrismaClient } from '@app/db';
import { compressionRatio, fleschPt, summaryPlainText } from '@app/pipeline';
import {
  earliestStageAffected,
  mergeConfig,
  parsePipelineConfig,
  type RerunBody,
  STAGE_ORDER,
  type StageName,
  type SummarizationOutput,
  stageIndex,
  TERMINAL_RUN_STATUSES,
} from '@app/shared';
import type { Env } from '../../env';
import { HttpError, notFound } from '../../http-error';
import { configHash } from '../../runtime/canonical-json';
import { effectiveStageRunId, loadStageOutputs } from '../../runtime/persistence/load-outputs';
import { materializeStageOutput } from '../../runtime/persistence/materialize';
import type { RunQueue } from '../../runtime/run-queue';
import { assertProvidersConfigured, toRunDto } from './service';

const DONE = ['completed', 'reused', 'overridden'];
const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/**
 * Reprocessing from a stage (spec §7): stages before `fromStage` are reused from the origin (resolved to the
 * stage run that holds the data); a summary override replaces the summarization checkpoint.
 */
export function createRerunService(deps: { prisma: PrismaClient; env: Env; queue: RunQueue }) {
  const { prisma } = deps;
  return {
    async rerun(parentId: string, body: RerunBody) {
      const parent = await prisma.run.findUnique({ where: { id: parentId }, include: { stageRuns: true } });
      if (!parent) throw notFound('Execução');
      if (!TERMINAL_RUN_STATUSES.includes(parent.status))
        throw new HttpError(409, 'RUN_NOT_COMPLETED', 'A execução de origem ainda não terminou.');

      const fromIndex = stageIndex(body.fromStage);
      const overrides = body.configOverrides ?? {};
      const affected = earliestStageAffected(overrides);
      if (affected && stageIndex(affected) < fromIndex)
        throw new HttpError(
          400,
          'OVERRIDE_BEFORE_FROM_STAGE',
          `As alterações de configuração afetam a etapa ${affected}, anterior a ${body.fromStage}.`,
          { affected, fromStage: body.fromStage },
        );
      if (body.summaryOverride && body.fromStage !== 'similarity')
        throw new HttpError(400, 'VALIDATION_ERROR', 'Os dados enviados são inválidos.', {
          issues: [
            {
              path: ['summaryOverride'],
              message: 'summaryOverride só é aceito com fromStage "similarity".',
              code: 'custom',
            },
          ],
        });

      const before = STAGE_ORDER.slice(0, fromIndex);
      const parentStage = (stage: StageName) => parent.stageRuns.find((s) => s.stage === stage);
      const missing = before.filter((stage) => !DONE.includes(parentStage(stage)?.status ?? ''));
      const overridesSummary = Boolean(body.summaryOverride);
      if (missing.filter((s) => !(overridesSummary && s === 'summarization')).length > 0)
        throw new HttpError(
          400,
          'MISSING_CHECKPOINT',
          'A execução de origem não tem os resultados das etapas anteriores.',
          {
            missing,
          },
        );

      const config = mergeConfig(parsePipelineConfig(parent.config), overrides);
      assertProvidersConfigured(config, deps.env);

      let overriddenOutput: SummarizationOutput | null = null;
      if (body.summaryOverride) {
        const text = (await loadStageOutputs(prisma, parent.id)).text_extraction;
        if (!text) throw new HttpError(400, 'MISSING_CHECKPOINT', 'A execução de origem não tem o texto extraído.');
        const plain = summaryPlainText(body.summaryOverride);
        overriddenOutput = {
          summary: body.summaryOverride,
          readability: { source: fleschPt(text.canonicalText), summary: fleschPt(plain) },
          compressionRatio: compressionRatio(text.stats.words, wordCount(plain)),
        };
      }

      const run = await prisma.$transaction(async (tx) => {
        const created = await tx.run.create({
          data: {
            documentId: parent.documentId,
            presetId: parent.presetId,
            parentRunId: parent.id,
            startFromStage: body.fromStage,
            label: body.label ?? null,
            status: 'queued',
            config: config as Prisma.InputJsonValue,
            configHash: configHash(config),
            injectedFaults: (body.injectedFaults ?? undefined) as Prisma.InputJsonValue | undefined,
            stageRuns: {
              create: STAGE_ORDER.map((stage, i) => {
                if (i >= fromIndex) return { stage, status: 'pending' as const };
                if (stage === 'summarization' && overriddenOutput)
                  return { stage, status: 'overridden' as const, output: overriddenOutput as Prisma.InputJsonValue };
                const origin = parentStage(stage);
                return {
                  stage,
                  status: 'reused' as const,
                  reusedFromStageRunId: origin ? effectiveStageRunId(origin) : null,
                };
              }),
            },
          },
          include: { stageRuns: true },
        });
        if (overriddenOutput) {
          const sr = created.stageRuns.find((s) => s.stage === 'summarization');
          if (sr)
            await materializeStageOutput(tx, {
              runId: created.id,
              stageRunId: sr.id,
              stage: 'summarization',
              output: overriddenOutput,
            });
        }
        return created;
      });
      deps.queue.enqueue(run.id);
      return toRunDto(prisma, run);
    },
  };
}

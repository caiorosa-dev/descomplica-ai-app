import { z } from 'zod';
import type { DeepPartial } from '../config/overrides';
import { PipelineConfig } from '../config/pipeline-config';
import { RunStatus, StageName, StageRunStatus } from '../domain/enums';
import { InjectedFault } from '../domain/faults';
import { StageError } from '../events';

/** Overrides are validated by merging them into the base config (mergeConfig re-parses the result). */
export const ConfigOverrides = z.record(z.string(), z.unknown()) as unknown as z.ZodType<DeepPartial<PipelineConfig>>;

export const CreateRunBody = z.object({
  documentId: z.string().uuid(),
  presetId: z.string().uuid(),
  configOverrides: ConfigOverrides.optional(),
  label: z.string().max(100).optional(),
});
export type CreateRunBody = z.infer<typeof CreateRunBody>;

export const StageWarning = z.object({ code: z.string(), message: z.string() });
export type StageWarning = z.infer<typeof StageWarning>;

export const StageRunDto = z.object({
  id: z.string(),
  stage: StageName,
  status: StageRunStatus,
  reusedFromStageRunId: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  metrics: z.unknown(),
  warnings: z.array(StageWarning),
  error: StageError.nullable(),
});
export type StageRunDto = z.infer<typeof StageRunDto>;

export const RunTotalsDto = z.object({
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
});

export const RunDto = z.object({
  id: z.string(),
  documentId: z.string(),
  presetId: z.string().nullable(),
  parentRunId: z.string().nullable(),
  startFromStage: StageName.nullable(),
  label: z.string().nullable(),
  status: RunStatus,
  config: PipelineConfig,
  configHash: z.string(),
  injectedFaults: z.array(InjectedFault).nullable(),
  error: StageError.nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  stages: z.array(StageRunDto),
  totals: RunTotalsDto,
});
export type RunDto = z.infer<typeof RunDto>;

export const ListRunsQuery = z.object({ documentId: z.string().uuid().optional(), label: z.string().optional() });

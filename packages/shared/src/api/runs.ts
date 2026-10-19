import { z } from 'zod';
import type { DeepPartial } from '../config/overrides';
import { PipelineConfig } from '../config/pipeline-config';
import { Classification, CleaningReport, PageRange, Section } from '../domain/document';
import { FactCategory, RunStatus, StageName, StageRunStatus } from '../domain/enums';
import { Ambiguity, Fact } from '../domain/facts';
import { InjectedFault } from '../domain/faults';
import { RunMetricsShape } from '../domain/metrics';
import { SimilarityMetrics, SimilarityOutput } from '../domain/similarity';
import { SummarizationOutput, Summary } from '../domain/summary';
import { Alert, Claim, VerificationItem } from '../domain/verification';
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

export const RerunBody = z.object({
  fromStage: StageName,
  configOverrides: ConfigOverrides.optional(),
  summaryOverride: Summary.optional(),
  label: z.string().max(100).optional(),
  injectedFaults: z.array(InjectedFault).optional(),
});
export type RerunBody = z.infer<typeof RerunBody>;

export const RunResultDto = z.object({
  classification: Classification.nullable(),
  sections: z.array(Section),
  facts: z.array(Fact),
  notFound: z.array(FactCategory),
  ambiguities: z.array(Ambiguity),
  summary: SummarizationOutput.nullable(),
  similarity: z.object({ metrics: SimilarityMetrics, headline: SimilarityOutput.shape.headline }).nullable(),
  claims: z.array(Claim),
  items: z.array(VerificationItem),
  alerts: z.array(Alert),
  metrics: RunMetricsShape.nullable(),
});
export type RunResultDto = z.infer<typeof RunResultDto>;

export const RunTextDto = z.object({
  canonicalText: z.string(),
  pageMap: z.array(PageRange),
  sections: z.array(Section),
  cleaningReport: CleaningReport,
  coverageByChunk: z
    .array(
      z.object({
        chunkId: z.string(),
        start: z.number().int(),
        end: z.number().int(),
        score: z.number(),
        highlighted: z.boolean(),
      }),
    )
    .nullable(),
  supportByParagraph: SimilarityOutput.shape.supportByParagraph.nullable(),
});
export type RunTextDto = z.infer<typeof RunTextDto>;

export const LlmCallSummaryDto = z.object({
  id: z.string(),
  agent: z.string(),
  agentVersion: z.string(),
  model: z.string(),
  attempt: z.number().int(),
  status: z.enum(['success', 'error']),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
  latencyMs: z.number().int(),
  createdAt: z.string(),
});
export type LlmCallSummaryDto = z.infer<typeof LlmCallSummaryDto>;

export const LlmCallDto = LlmCallSummaryDto.extend({
  params: z.unknown(),
  messages: z.unknown(),
  rawResponse: z.unknown(),
  parsedOutput: z.unknown(),
  error: z.unknown(),
});
export type LlmCallDto = z.infer<typeof LlmCallDto>;

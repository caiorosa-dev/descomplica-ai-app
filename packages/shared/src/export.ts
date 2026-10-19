import { z } from 'zod';
import { PipelineConfig } from './config/pipeline-config';
import { Classification } from './domain/document';
import { DocumentSource, RunStatus } from './domain/enums';
import { Fact } from './domain/facts';
import { RunMetricsShape } from './domain/metrics';
import { SummarizationOutput } from './domain/summary';
import { Alert, Claim, VerificationItem } from './domain/verification';

/** File of `GET /runs/:id/export?format=json` (spec §11). */
export const RunExportV1 = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  document: z.object({
    id: z.string(),
    filename: z.string(),
    sha256: z.string(),
    source: DocumentSource,
    corpusKey: z.string().nullable(),
  }),
  run: z.object({
    id: z.string(),
    status: RunStatus,
    presetSlug: z.string().nullable(),
    parentRunId: z.string().nullable(),
    label: z.string().nullable(),
    configHash: z.string(),
    config: PipelineConfig,
  }),
  classification: Classification.nullable(),
  facts: z.array(Fact),
  summary: SummarizationOutput.nullable(),
  metrics: RunMetricsShape.nullable(),
  claims: z.array(Claim),
  verificationItems: z.array(VerificationItem),
  alerts: z.array(Alert),
  costs: z.object({ inputTokens: z.number().int(), outputTokens: z.number().int(), costUsd: z.number() }),
});
export type RunExportV1 = z.infer<typeof RunExportV1>;

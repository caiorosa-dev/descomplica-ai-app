import type { PrismaClient } from '@app/db';
import {
  InformationExtractionOutput,
  RunMetricsShape,
  SimilarityOutput,
  type StageName,
  SummarizationOutput,
  TextExtractionOutput,
  VerificationOutput,
} from '@app/shared';
import type { z } from 'zod';

export const STAGE_OUTPUT_SCHEMAS = {
  text_extraction: TextExtractionOutput,
  information_extraction: InformationExtractionOutput,
  summarization: SummarizationOutput,
  similarity: SimilarityOutput,
  verification: VerificationOutput,
  report: RunMetricsShape,
} as const satisfies Record<StageName, z.ZodType>;

export type StageOutputs = { [S in StageName]: z.infer<(typeof STAGE_OUTPUT_SCHEMAS)[S]> };

/** The StageRun that holds the data: the origin of a reused stage run (always stored resolved), else itself. */
export function effectiveStageRunId(sr: { id: string; reusedFromStageRunId: string | null }): string {
  return sr.reusedFromStageRunId ?? sr.id;
}

const DONE = ['completed', 'reused', 'overridden'];

/** Outputs of the run's finished stages, read from the effective stage runs and validated with each stage's schema. */
export async function loadStageOutputs(prisma: PrismaClient, runId: string): Promise<Partial<StageOutputs>> {
  const stageRuns = await prisma.stageRun.findMany({
    where: { runId, status: { in: ['completed', 'reused', 'overridden'] } },
    include: { reusedFrom: { select: { output: true } } },
  });
  const outputs: Partial<StageOutputs> = {};
  for (const sr of stageRuns) {
    if (!DONE.includes(sr.status)) continue;
    const raw = sr.reusedFromStageRunId ? sr.reusedFrom?.output : sr.output;
    if (raw == null) continue;
    const stage = sr.stage as StageName;
    (outputs as Record<StageName, unknown>)[stage] = STAGE_OUTPUT_SCHEMAS[stage].parse(raw);
  }
  return outputs;
}

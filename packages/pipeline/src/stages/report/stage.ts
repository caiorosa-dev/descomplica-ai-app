import {
  type InformationExtractionOutput,
  RunMetricsShape,
  type SimilarityOutput,
  type SummarizationOutput,
  type VerificationOutput,
} from '@app/shared';
import type { Stage } from '../../core/stage';

export interface RunTotals {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface ReportInput {
  info: InformationExtractionOutput;
  summarization: SummarizationOutput;
  similarity: SimilarityOutput;
  verification: VerificationOutput;
  totals: RunTotals;
}

const finiteOrNull = (n: number | null): number | null => (n === null || !Number.isFinite(n) ? null : n);
const finiteOrZero = (n: number): number => (Number.isFinite(n) ? n : 0);

/** Consolidates the run's metrics without any LLM call (spec §6.6). */
export const reportStage: Stage<ReportInput, RunMetricsShape> = {
  name: 'report',
  output: RunMetricsShape,
  async run(input, ctx) {
    ctx.events.progress('Consolidando as métricas');
    const { metrics } = input.similarity;
    const alerts = input.verification.alerts;
    const count = (severity: string) => alerts.filter((a) => a.severity === severity).length;
    return {
      centroid: finiteOrNull(metrics.centroid),
      coverage: finiteOrNull(metrics.coverage),
      support: finiteOrNull(metrics.support),
      alignmentF1: finiteOrNull(metrics.alignmentF1),
      factualConsistency: finiteOrNull(input.verification.metrics.factualConsistency),
      claimSupport: finiteOrNull(input.verification.metrics.claimSupport),
      unverifiableCount: input.verification.metrics.unverifiableCount,
      factsConfirmed: input.info.facts.filter((f) => f.status === 'confirmed').length,
      factsUncertain: input.info.facts.filter((f) => f.status === 'uncertain').length,
      alertsHigh: count('high'),
      alertsMedium: count('medium'),
      alertsLow: count('low'),
      readabilitySource: finiteOrNull(input.summarization.readability.source),
      readabilitySummary: finiteOrNull(input.summarization.readability.summary),
      compressionRatio: finiteOrNull(input.summarization.compressionRatio),
      inputTokens: input.totals.inputTokens,
      outputTokens: input.totals.outputTokens,
      costUsd: finiteOrZero(input.totals.costUsd),
      durationMs: Math.round(input.totals.durationMs),
    };
  },
};

import { z } from 'zod';

const nullableNumber = z.number().nullable();
const count = z.number().int();

/** The fields of the `RunMetrics` table (spec §10). Metrics that may be undefined for a run are null. */
export const RunMetricsShape = z.object({
  centroid: nullableNumber,
  coverage: nullableNumber,
  support: nullableNumber,
  alignmentF1: nullableNumber,
  factualConsistency: nullableNumber,
  claimSupport: nullableNumber,
  unverifiableCount: count,
  factsConfirmed: count,
  factsUncertain: count,
  alertsHigh: count,
  alertsMedium: count,
  alertsLow: count,
  readabilitySource: nullableNumber,
  readabilitySummary: nullableNumber,
  compressionRatio: nullableNumber,
  inputTokens: count,
  outputTokens: count,
  costUsd: z.number(),
  durationMs: count,
});
export type RunMetricsShape = z.infer<typeof RunMetricsShape>;

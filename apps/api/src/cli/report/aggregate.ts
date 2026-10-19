import type { CorpusManifestEntry, DocumentType, FactCategory, RunStatus } from '@app/shared';

/** One document × preset of a corpus evaluation (spec §13.2). */
export interface EvalRow {
  key: string;
  preset: string;
  runId: string;
  status: RunStatus;
  expectedType: DocumentType | null;
  detectedType: DocumentType | null;
  factsConfirmed: number;
  factsUncertain: number;
  factsByCategory: Partial<Record<FactCategory, number>>;
  readabilitySource: number | null;
  readabilitySummary: number | null;
  compressionRatio: number | null;
  centroid: number | null;
  coverage: number | null;
  support: number | null;
  alignmentF1: number | null;
  factualConsistency: number | null;
  claimSupport: number | null;
  unverifiableCount: number;
  alertsHigh: number;
  alertsMedium: number;
  alertsLow: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export const MEAN_FIELDS = [
  'readabilitySource',
  'readabilitySummary',
  'compressionRatio',
  'centroid',
  'coverage',
  'support',
  'alignmentF1',
  'factualConsistency',
  'claimSupport',
  'unverifiableCount',
  'alertsHigh',
  'alertsMedium',
  'alertsLow',
  'costUsd',
  'durationMs',
] as const satisfies readonly (keyof EvalRow)[];

export type MeanField = (typeof MEAN_FIELDS)[number];

export interface PresetSummary {
  preset: string;
  runs: number;
  completed: number;
  classificationAccuracy: number | null;
  /** Pearson correlation between alignmentF1 and factualConsistency over the preset's documents. */
  correlation: number | null;
  means: Record<MeanField, number | null>;
  totalCostUsd: number;
}

export interface EvalSummary {
  byPreset: PresetSummary[];
}

/** Pearson's r; null with fewer than 3 pairs or zero variance. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Diagonal = a summary against its own document; off-diagonal = against the other documents. */
export function crossMatrixStats(matrix: number[][]): {
  diagonalMean: number;
  offDiagonalMean: number;
  diagonalIsRowMaxRate: number;
} {
  const n = matrix.length;
  let diagonal = 0;
  let off = 0;
  let offCount = 0;
  let rowMax = 0;
  for (let i = 0; i < n; i++) {
    const row = matrix[i] ?? [];
    diagonal += row[i] ?? 0;
    for (let j = 0; j < row.length; j++)
      if (j !== i) {
        off += row[j] ?? 0;
        offCount++;
      }
    if ((row[i] ?? Number.NEGATIVE_INFINITY) >= Math.max(...row)) rowMax++;
  }
  const round = (x: number) => Math.round(x * 1e9) / 1e9;
  return {
    diagonalMean: n ? round(diagonal / n) : 0,
    offDiagonalMean: offCount ? round(off / offCount) : 0,
    diagonalIsRowMaxRate: n ? rowMax / n : 0,
  };
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
}

export function aggregate(rows: EvalRow[], manifest: CorpusManifestEntry[]): EvalSummary {
  const expected = new Map(manifest.map((m) => [m.key, m.expectedType]));
  const presets = [...new Set(rows.map((r) => r.preset))];
  return {
    byPreset: presets.map((preset) => {
      const all = rows.filter((r) => r.preset === preset);
      const done = all.filter((r) => r.status === 'completed');
      const classified = done.filter((r) => expected.has(r.key));
      const pairs = done.filter((r) => r.alignmentF1 !== null && r.factualConsistency !== null);
      return {
        preset,
        runs: all.length,
        completed: done.length,
        classificationAccuracy: classified.length
          ? classified.filter((r) => r.detectedType === expected.get(r.key)).length / classified.length
          : null,
        correlation: pearson(
          pairs.map((r) => r.alignmentF1 as number),
          pairs.map((r) => r.factualConsistency as number),
        ),
        means: Object.fromEntries(MEAN_FIELDS.map((f) => [f, mean(done.map((r) => r[f] as number | null))])) as Record<
          MeanField,
          number | null
        >,
        totalCostUsd: all.reduce((sum, r) => sum + r.costUsd, 0),
      };
    }),
  };
}

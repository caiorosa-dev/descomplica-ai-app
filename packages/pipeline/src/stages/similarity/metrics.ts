import type { SimilarityMetrics } from '@app/shared';

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] as number) * (b[i] ?? 0);
  return sum;
}

export function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(dot(v, v));
  return norm === 0 ? v.map(() => 0) : v.map((x) => x / norm);
}

export function meanVector(vs: number[][]): number[] {
  if (vs.length === 0) return [];
  const out = new Array<number>((vs[0] as number[]).length).fill(0);
  for (const v of vs) for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) + (v[i] ?? 0) / vs.length;
  return out;
}

function maxDot(v: number[], others: number[][]): number {
  return others.reduce((best, o) => Math.max(best, dot(v, o)), Number.NEGATIVE_INFINITY);
}

/**
 * Similarity metrics over L2-normalized vectors (spec §6.4): centroid, token-weighted coverage of the source,
 * support of the summary, and their harmonic mean.
 */
export function computeAlignment(
  source: { vector: number[]; tokens: number }[],
  summary: number[][],
): { metrics: SimilarityMetrics; coverageScores: number[]; supportScores: number[] } {
  if (source.length === 0 || summary.length === 0)
    return {
      metrics: { centroid: 0, coverage: 0, support: 0, alignmentF1: 0 },
      coverageScores: source.map(() => 0),
      supportScores: summary.map(() => 0),
    };
  const sourceVectors = source.map((s) => s.vector);
  const coverageScores = sourceVectors.map((v) => maxDot(v, summary));
  const supportScores = summary.map((v) => maxDot(v, sourceVectors));
  const totalTokens = source.reduce((sum, s) => sum + s.tokens, 0);
  const coverage =
    totalTokens > 0
      ? source.reduce((sum, s, i) => sum + (coverageScores[i] as number) * s.tokens, 0) / totalTokens
      : coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length;
  const support = supportScores.reduce((a, b) => a + b, 0) / supportScores.length;
  const centroid = dot(normalizeVector(meanVector(sourceVectors)), normalizeVector(meanVector(summary)));
  const alignmentF1 = coverage + support > 0 ? (2 * coverage * support) / (coverage + support) : 0;
  return { metrics: { centroid, coverage, support, alignmentF1 }, coverageScores, supportScores };
}

/** Flags the floor(n × percent / 100) lowest scores; ties go to the lower index. */
export function markBottomPercent(scores: number[], percent: number): boolean[] {
  const k = Math.floor((scores.length * percent) / 100);
  const lowest = new Set(
    scores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .slice(0, k)
      .map((x) => x.index),
  );
  return scores.map((_, i) => lowest.has(i));
}

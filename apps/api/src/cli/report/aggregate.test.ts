import type { CorpusManifestEntry } from '@app/shared';
import { aggregate, crossMatrixStats, type EvalRow, pearson } from './aggregate';

test('pearson', () => {
  expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
  expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  expect(pearson([1, 2], [1, 2])).toBeNull();
});

test('crossMatrixStats', () =>
  expect(
    crossMatrixStats([
      [0.9, 0.5],
      [0.4, 0.8],
    ]),
  ).toEqual({ diagonalMean: 0.85, offDiagonalMean: 0.45, diagonalIsRowMaxRate: 1 }));

const row = (over: Partial<EvalRow>): EvalRow => ({
  key: 'stj-a',
  preset: 'budget',
  runId: 'r',
  status: 'completed',
  expectedType: null,
  detectedType: 'court_decision',
  factsConfirmed: 2,
  factsUncertain: 1,
  factsByCategory: {},
  readabilitySource: 30,
  readabilitySummary: 60,
  compressionRatio: 5,
  centroid: 0.9,
  coverage: 0.7,
  support: 0.8,
  alignmentF1: 0.75,
  factualConsistency: 0.5,
  claimSupport: 0.9,
  unverifiableCount: 0,
  alertsHigh: 0,
  alertsMedium: 1,
  alertsLow: 0,
  inputTokens: 100,
  outputTokens: 50,
  costUsd: 0.01,
  durationMs: 1000,
  ...over,
});
const entry = (key: string, expectedType: CorpusManifestEntry['expectedType']): CorpusManifestEntry => ({
  key,
  file: `stj/${key}.pdf`,
  issuer: 'STJ',
  title: key,
  expectedType,
  expectedSubtype: null,
  version: 'original',
});

test('classification accuracy uses manifest expectedType', () => {
  const summary = aggregate(
    [
      row({ key: 'stj-a', detectedType: 'court_decision' }),
      row({ key: 'stj-b', detectedType: 'generic' }),
      row({ key: 'cnj-c', detectedType: 'normative_act' }),
      row({ key: 'cnj-d', detectedType: null, status: 'failed' }),
    ],
    [
      entry('stj-a', 'court_decision'),
      entry('stj-b', 'court_decision'),
      entry('cnj-c', 'normative_act'),
      entry('cnj-d', 'normative_act'),
    ],
  );
  const budget = summary.byPreset.find((p) => p.preset === 'budget')!;
  expect(budget.runs).toBe(4);
  expect(budget.completed).toBe(3);
  expect(budget.classificationAccuracy).toBeCloseTo(2 / 3);
  expect(budget.means.alignmentF1).toBeCloseTo(0.75);
});

test('correlation per preset and null-safe means', () => {
  const summary = aggregate(
    [
      row({ key: 'a', alignmentF1: 0.6, factualConsistency: 0.2 }),
      row({ key: 'b', alignmentF1: 0.7, factualConsistency: 0.5 }),
      row({ key: 'c', alignmentF1: 0.8, factualConsistency: null }),
      row({ key: 'd', alignmentF1: 0.9, factualConsistency: 0.9 }),
    ],
    [],
  );
  const p = summary.byPreset[0]!;
  expect(p.correlation).toBeCloseTo(pearson([0.6, 0.7, 0.9], [0.2, 0.5, 0.9])!);
  expect(p.means.factualConsistency).toBeCloseTo((0.2 + 0.5 + 0.9) / 3);
  expect(p.classificationAccuracy).toBeNull();
});

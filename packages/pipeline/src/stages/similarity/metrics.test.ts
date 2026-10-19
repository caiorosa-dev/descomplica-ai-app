import { computeAlignment, dot, markBottomPercent, meanVector, normalizeVector } from './metrics';

test('identical → 1, orthogonal → 0', () => {
  expect(computeAlignment([{ vector: [1, 0], tokens: 1 }], [[1, 0]]).metrics).toEqual({
    centroid: 1,
    coverage: 1,
    support: 1,
    alignmentF1: 1,
  });
  expect(computeAlignment([{ vector: [1, 0], tokens: 1 }], [[0, 1]]).metrics.alignmentF1).toBe(0);
});

test('coverage weighted by tokens', () =>
  expect(
    computeAlignment(
      [
        { vector: [1, 0], tokens: 3 },
        { vector: [0, 1], tokens: 1 },
      ],
      [[1, 0]],
    ).metrics.coverage,
  ).toBeCloseTo(0.75));

test('alignmentF1 is harmonic mean', () => {
  const r = computeAlignment(
    [
      { vector: [1, 0], tokens: 1 },
      { vector: [0, 1], tokens: 1 },
    ],
    [[1, 0]],
  );
  expect(r.metrics.coverage).toBeCloseTo(0.5);
  expect(r.metrics.support).toBeCloseTo(1);
  expect(r.metrics.alignmentF1).toBeCloseTo(2 / 3, 4);
  expect(r.coverageScores).toEqual([1, 0]);
  expect(r.supportScores).toEqual([1]);
});

test('empty inputs give zeros', () =>
  expect(computeAlignment([], []).metrics).toEqual({ centroid: 0, coverage: 0, support: 0, alignmentF1: 0 }));

test('vector helpers', () => {
  expect(normalizeVector([3, 4])).toEqual([0.6, 0.8]);
  expect(normalizeVector([0, 0])).toEqual([0, 0]);
  expect(dot([1, 2], [3, 4])).toBe(11);
  expect(
    meanVector([
      [1, 0],
      [0, 1],
    ]),
  ).toEqual([0.5, 0.5]);
});

test('markBottomPercent', () => {
  expect(markBottomPercent([0.9, 0.1, 0.5, 0.3, 0.7], 40)).toEqual([false, true, false, true, false]);
  expect(markBottomPercent([0.9, 0.1, 0.5, 0.3], 20)).toEqual([false, false, false, false]);
  expect(markBottomPercent([0.5, 0.5, 0.5], 34)).toEqual([true, false, false]);
});

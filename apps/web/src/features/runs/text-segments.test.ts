import { buildTextSegments, coverageClass } from './text-segments';

test('segments split on overlaps', () =>
  expect(
    buildTextSegments(10, [
      { start: 2, end: 6, className: 'a' },
      { start: 4, end: 8, className: 'b' },
    ]),
  ).toEqual([
    { start: 0, end: 2, classNames: [] },
    { start: 2, end: 4, classNames: ['a'] },
    { start: 4, end: 6, classNames: ['a', 'b'] },
    { start: 6, end: 8, classNames: ['b'] },
    { start: 8, end: 10, classNames: [] },
  ]));

test('no ranges gives one plain segment; ranges are clamped to the text', () => {
  expect(buildTextSegments(5, [])).toEqual([{ start: 0, end: 5, classNames: [] }]);
  expect(buildTextSegments(5, [{ start: 3, end: 50, className: 'x' }])).toEqual([
    { start: 0, end: 3, classNames: [] },
    { start: 3, end: 5, classNames: ['x'] },
  ]);
  expect(buildTextSegments(0, [])).toEqual([]);
});

test('coverageClass bands and highlight', () => {
  const bands = [0.1, 0.3, 0.5, 0.7, 0.9].map((s) => coverageClass(s, false));
  expect(new Set(bands).size).toBe(5);
  expect(coverageClass(0.9, true)).toContain('destructive');
  expect(coverageClass(0.1, false)).not.toContain('destructive');
});

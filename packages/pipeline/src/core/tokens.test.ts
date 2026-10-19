import { countTokens, headTokens, splitByTokens, tailTokens } from './tokens';

test('countTokens', () => {
  expect(countTokens('')).toBe(0);
  expect(countTokens('Recurso especial provido.')).toBeGreaterThan(0);
});

test('headTokens and tailTokens keep the ends of the text', () => {
  const text = Array.from({ length: 200 }, (_, i) => `palavra${i}`).join(' ');
  const head = headTokens(text, 10);
  const tail = tailTokens(text, 10);
  expect(text.startsWith(head)).toBe(true);
  expect(text.endsWith(tail)).toBe(true);
  expect(countTokens(head)).toBeLessThanOrEqual(10);
  expect(countTokens(tail)).toBeLessThanOrEqual(10);
  expect(headTokens(text, 0)).toBe('');
  expect(headTokens('curto', 50)).toBe('curto');
});

describe('splitByTokens', () => {
  const text = Array.from({ length: 300 }, (_, i) => `palavra${i}`).join(' ');

  test('windows cover the text in order, respect the limit and overlap', () => {
    const windows = splitByTokens(text, 50, 10);
    expect(windows.length).toBeGreaterThan(3);
    expect(windows[0]!.start).toBe(0);
    expect(windows.at(-1)!.end).toBe(text.length);
    for (const w of windows) expect(countTokens(text.slice(w.start, w.end))).toBeLessThanOrEqual(50);
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]!.start).toBeLessThan(windows[i - 1]!.end);
      expect(windows[i]!.start).toBeGreaterThan(windows[i - 1]!.start);
    }
  });

  test('without overlap windows are contiguous', () => {
    const windows = splitByTokens(text, 50, 0);
    for (let i = 1; i < windows.length; i++) expect(windows[i]!.start).toBe(windows[i - 1]!.end);
  });

  test('short text is one window', () => expect(splitByTokens('curto', 50, 10)).toEqual([{ start: 0, end: 5 }]));
});

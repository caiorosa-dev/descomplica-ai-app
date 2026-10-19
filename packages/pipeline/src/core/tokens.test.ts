import { countTokens, headTokens, tailTokens } from './tokens';

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

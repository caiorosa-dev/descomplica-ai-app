import type { Section } from '@app/shared';
import { groundQuote } from './ground-quote';
import { buildGroundingIndex } from './index';
import { normalizeWithMap } from './normalize';

const text = 'O Tribunal  negou\nprovimento ao recurso especial interposto pela União.';
const idx = buildGroundingIndex(text, [{ page: 1, start: 0, end: text.length }], []);

test('normalizeWithMap maps normalized positions back to the original', () => {
  const { normalized, map } = normalizeWithMap('A  “Lei”\n—B');
  expect(normalized).toBe('a "lei" -b');
  expect(map).toHaveLength(normalized.length + 1);
  expect(map.at(-1)).toBe('A  “Lei”\n—B'.length);
  expect(map[2]).toBe(3);
});

test('exact ignoring case and whitespace', () => {
  const m = groundQuote('tribunal negou provimento', idx, 0.9);
  expect(m.matchType).toBe('exact');
  expect(text.slice(m.start!, m.end!)).toBe('Tribunal  negou\nprovimento');
  expect(m.page).toBe(1);
  expect(m.matchScore).toBe(1);
});

test('curly quotes normalized', () => {
  const quoted = 'Disse que “negou” o pedido.';
  const i = buildGroundingIndex(quoted, [{ page: 1, start: 0, end: quoted.length }], []);
  const m = groundQuote('"negou" o pedido', i, 0.9);
  expect(m.matchType).toBe('exact');
  expect(quoted.slice(m.start!, m.end!)).toBe('“negou” o pedido');
});

test('fuzzy with a typo', () => {
  const m = groundQuote('negou provimeto ao recurso especial', idx, 0.9);
  expect(m.matchType).toBe('fuzzy');
  expect(m.matchScore!).toBeGreaterThanOrEqual(0.9);
  expect(m.matchScore!).toBeLessThan(1);
  expect(text.slice(m.start!, m.end!)).toContain('provimento ao recurso');
});

test('not found', () => {
  const m = groundQuote('deu provimento à apelação do município', idx, 0.9);
  expect(m).toEqual({ start: null, end: null, page: null, sectionId: null, matchType: 'not_found', matchScore: null });
});

test('ellipsis segments grounded in order (Review Focus 1)', () => {
  const m = groundQuote('O Tribunal [...] interposto pela União', idx, 0.9);
  expect(m.matchType).toBe('exact');
  expect(text.slice(m.start!, m.end!)).toBe('O Tribunal  negou\nprovimento ao recurso especial interposto pela União');
  expect(groundQuote('O Tribunal ... pelo Estado', idx, 0.9).matchType).toBe('not_found');
  expect(groundQuote('O Tribunal … interposto pela União', idx, 0.9).matchType).toBe('exact');
  expect(groundQuote('interposto pela União (...) O Tribunal', idx, 0.9).matchType).toBe('not_found');
});

test('section and page lookup', () => {
  const two = 'Primeira página aqui.\n\nSegunda página com o trecho buscado.';
  const sections: Section[] = [
    { id: 'S01', kind: 'paragraph', label: 'Parágrafo 1', parentLabel: null, start: 0, end: 20 },
    { id: 'S02', kind: 'paragraph', label: 'Parágrafo 2', parentLabel: null, start: 23, end: two.length },
  ];
  const i = buildGroundingIndex(
    two,
    [
      { page: 1, start: 0, end: 21 },
      { page: 2, start: 23, end: two.length },
    ],
    sections,
  );
  expect(groundQuote('Primeira página', i, 0.9)).toMatchObject({ sectionId: 'S01', page: 1 });
  expect(groundQuote('o trecho buscado', i, 0.9)).toMatchObject({ sectionId: 'S02', page: 2 });
});

test('first occurrence wins', () => {
  const rep = 'a regra vale. depois a regra vale de novo.';
  const m = groundQuote('a regra vale', buildGroundingIndex(rep, [], []), 0.9);
  expect(m.start).toBe(0);
  expect(m.page).toBeNull();
});

test('performance guard', () => {
  const words = Array.from({ length: 9000 }, (_, i) => `termo${(i * 7919) % 5000}`);
  const big = words.join(' ').slice(0, 50_000);
  const i = buildGroundingIndex(big, [{ page: 1, start: 0, end: big.length }], []);
  const quotes = Array.from({ length: 100 }, (_, k) =>
    k % 2 ? words.slice(k * 50, k * 50 + 8).join(' ') : `inexistente ${k} trecho que não está no texto em lugar nenhum`,
  );
  const t0 = performance.now();
  for (const q of quotes) groundQuote(q, i, 0.9);
  expect(performance.now() - t0).toBeLessThan(500);
});

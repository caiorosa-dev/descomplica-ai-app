import { compressionRatio, countSyllablesPt, fleschPt, splitSentences } from './readability';

test.each([
  ['casa', 2],
  ['jurídico', 4],
  ['pão', 1],
  ['Judiciário', 4],
  ['STJ', 1],
])('syllables %s', (w, n) => expect(countSyllablesPt(w)).toBe(n));

test('abbreviations do not split sentences', () =>
  expect(splitSentences('Conforme o art. 5º, o pedido foi negado. O Min. Relator votou.')).toHaveLength(2));

test('sentence endings', () => {
  expect(splitSentences('Foi negado! Por quê? Porque sim.')).toEqual(['Foi negado!', 'Por quê?', 'Porque sim.']);
  expect(splitSentences('Valor de R$ 1.234,56 pago.')).toHaveLength(1);
  expect(splitSentences('')).toEqual([]);
});

test('simpler text scores higher', () =>
  expect(fleschPt('O juiz negou o pedido.')).toBeGreaterThan(
    fleschPt(
      'A jurisprudência consolidada desta Corte Superior estabelece a imprescindibilidade da demonstração inequívoca do prejuízo processual.',
    ),
  ));

test('formula of Martins et al. (1996)', () => {
  // 5 words, 1 sentence, 8 syllables: o, juiz (1), ne-gou (2), o, pe-di-do (3).
  expect(fleschPt('O juiz negou o pedido.')).toBeCloseTo(248.835 - 1.015 * 5 - 84.6 * (8 / 5), 3);
});

test('empty text', () => expect(fleschPt('')).toBe(0));

test('compression', () => {
  expect(compressionRatio(1000, 250)).toBe(4);
  expect(compressionRatio(1000, 0)).toBe(0);
});

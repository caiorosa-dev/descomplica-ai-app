import type { Summary } from '@app/shared';
import { claimExtractorAgent } from '../../agents/claim-extractor/agent';
import { createMockContext } from '../../testing/mock-model';
import { extractClaims } from './claims';

const summary: Summary = {
  title: 't',
  overview: 'Em resumo, o recurso foi negado.',
  sections: [
    {
      heading: 'A',
      paragraphs: [
        { text: 'O prazo é de R$ 10 mil.', factRefs: [] },
        { text: 'Segundo.', factRefs: [] },
      ],
    },
    { heading: 'B', paragraphs: [{ text: 'Terceiro.', factRefs: [] }] },
  ],
  glossary: [],
};

test('extractClaims numbers claims, maps paragraph indexes and retypes values', async () => {
  const ctx = createMockContext([
    [
      claimExtractorAgent,
      () => ({
        claims: [
          { text: 'O recurso foi negado.', paragraphIndexInInput: 0, category: 'untyped', value: null },
          {
            text: 'A multa é de R$ 10 mil.',
            paragraphIndexInInput: 1,
            category: 'monetary_value',
            value: { amount: 10, currency: 'BRL', role: 'multa' },
          },
          { text: 'Terceiro.', paragraphIndexInInput: 3, category: 'untyped', value: null },
          { text: 'Índice inválido.', paragraphIndexInInput: 42, category: 'untyped', value: null },
        ],
      }),
    ],
  ]);
  const claims = await extractClaims(summary, ctx);
  expect(claims.map((c) => [c.id, c.paragraphRef, c.category])).toEqual([
    ['A01', null, null],
    ['A02', { sectionIndex: 0, paragraphIndex: 0 }, 'monetary_value'],
    ['A03', { sectionIndex: 1, paragraphIndex: 0 }, null],
    ['A04', null, null],
  ]);
  expect(claims[1]!.value).toMatchObject({ amount: 10_000 });
  expect(ctx.calls[0]!.prompt).toContain('[2] Segundo.');
});

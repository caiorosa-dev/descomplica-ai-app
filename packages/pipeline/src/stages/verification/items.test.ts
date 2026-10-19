import type { Chunk, Claim, Fact, Summary } from '@app/shared';
import { buildItems, renderFact } from './items';
import type { Pairing } from './pairing';

const text = 'O prazo para recorrer é de 15 (quinze) dias úteis, contados da intimação.';
const ev = {
  quote: '15 (quinze) dias úteis',
  start: 27,
  end: 49,
  page: 1,
  sectionId: null,
  matchType: 'exact' as const,
  matchScore: 1,
};
const deadline: Fact = {
  id: 'F01',
  category: 'deadline',
  label: 'Prazo para recorrer',
  value: { amount: 15, unit: 'days', businessDays: true, trigger: 'intimação' },
  evidence: [ev],
  confidence: 'high',
  status: 'confirmed',
  uncertaintyReasons: [],
};
const uncertainDeadline: Fact = { ...deadline, status: 'uncertain', uncertaintyReasons: ['quote_not_found'] };
const summary: Summary = {
  title: 't',
  overview: 'Resumo.',
  sections: [{ heading: 'h', paragraphs: [{ text: 'O prazo é de 15 dias úteis.', factRefs: ['F01'] }] }],
  glossary: [],
};
const claim: Claim = {
  id: 'A01',
  text: 'O prazo é de 15 dias úteis.',
  paragraphRef: { sectionIndex: 0, paragraphIndex: 0 },
  category: 'deadline',
  value: { amount: 15, unit: 'days', businessDays: true, trigger: null },
};
const chunks: Chunk[] = [{ id: 'C001', start: 0, end: text.length, tokens: 20 }];
const pairing = (c: Claim, facts: Fact[]): Pairing => ({
  claim: c,
  candidateFacts: facts,
  chunks: [{ chunkId: 'C001', start: 0, end: text.length, score: 0.9 }],
});
const base = {
  facts: [deadline],
  claims: [] as Claim[],
  pairings: [] as Pairing[],
  summary,
  text,
  chunks,
  deterministicFirst: true,
  directions: ['source_to_summary', 'summary_to_source'] as ('source_to_summary' | 'summary_to_source')[],
};

test('uncertain fact decided by code as unverifiable', () => {
  const { decided, pending } = buildItems({ ...base, facts: [uncertainDeadline] });
  expect(decided[0]).toMatchObject({
    verdict: 'unverifiable',
    decidedBy: 'code',
    factId: 'F01',
    direction: 'source_to_summary',
  });
  expect(decided[0]!.explanation).toContain('citação não encontrada');
  expect(pending).toHaveLength(0);
});

test('equal typed values decided by code', () => {
  const { decided, pending } = buildItems({ ...base, claims: [claim], pairings: [pairing(claim, [deadline])] });
  expect(decided.map((i) => [i.direction, i.verdict, i.decidedBy, i.factId, i.claimId])).toEqual([
    ['summary_to_source', 'supported', 'code', 'F01', 'A01'],
    ['source_to_summary', 'consistent', 'code', 'F01', 'A01'],
  ]);
  expect(decided[0]!.explanation).toBe('O valor no resumo confere com o documento (Prazo para recorrer).');
  expect(pending).toHaveLength(0);
  expect(decided.map((i) => i.id)).toEqual(['V001', 'V002']);
});

test('different values go to the verifier with anchored quotes and retrieved chunks', () => {
  const wrong: Claim = {
    ...claim,
    text: 'O prazo é de 30 dias.',
    value: { amount: 30, unit: 'days', businessDays: null, trigger: null },
  };
  const { decided, pending } = buildItems({ ...base, claims: [wrong], pairings: [pairing(wrong, [deadline])] });
  expect(decided).toEqual([]);
  expect(pending.map((p) => [p.itemId, p.direction])).toEqual([
    ['V001', 'summary_to_source'],
    ['V002', 'source_to_summary'],
  ]);
  expect(pending[0]!.subject).toBe('O prazo é de 30 dias.');
  expect(pending[0]!.sourceExcerpts).toEqual(['15 (quinze) dias úteis', text]);
  expect(pending[1]!.subject).toBe(renderFact(deadline));
  expect(pending[1]!.summaryText).toContain('O prazo é de 15 dias úteis.');
});

test('deterministicFirst off sends everything to the verifier', () => {
  const { decided, pending } = buildItems({
    ...base,
    claims: [claim],
    pairings: [pairing(claim, [deadline])],
    deterministicFirst: false,
  });
  expect(decided).toEqual([]);
  expect(pending).toHaveLength(2);
});

test('directions limit items', () => {
  const r = buildItems({
    ...base,
    claims: [claim],
    pairings: [pairing(claim, [deadline])],
    directions: ['summary_to_source'],
  });
  expect(
    [...r.decided, ...r.pending].every((i) => ('direction' in i ? i.direction : null) === 'summary_to_source'),
  ).toBe(true);
});

test('renderFact in pt-BR', () => {
  expect(renderFact(deadline)).toBe('Prazo para recorrer: 15 dias úteis, a partir de intimação');
  expect(
    renderFact({
      ...deadline,
      category: 'monetary_value',
      label: 'Multa',
      value: { amount: 1234.5, currency: 'BRL', role: 'multa' },
    } as Fact),
  ).toBe('Multa: R$ 1.234,50');
  expect(
    renderFact({
      ...deadline,
      category: 'date',
      label: 'Julgamento',
      value: { iso: '2025-03-24', role: 'judgment' },
    } as Fact),
  ).toBe('Julgamento: 24/03/2025 (julgamento)');
});

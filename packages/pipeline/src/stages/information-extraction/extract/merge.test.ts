import type { GroundedEvidence, GroundedFactDraft } from '@app/shared';
import { type GroundedExtractorOutput, mergeFacts, valueKey } from './merge';

const evidence = (start: number | null, quote: string): GroundedEvidence => ({
  quote,
  start,
  end: start === null ? null : start + 10,
  page: start === null ? null : 1,
  sectionId: null,
  matchType: start === null ? 'not_found' : 'exact',
  matchScore: start === null ? null : 1,
});
const deadlineAt = (
  start: number | null,
  amount: number,
  confidence: 'low' | 'medium' | 'high',
  quote: string,
): GroundedFactDraft => ({
  id: 'F01',
  category: 'deadline',
  label: 'Prazo',
  value: { amount, unit: 'days', businessDays: null, trigger: null },
  evidence: [evidence(start, quote)],
  confidence,
});
const out = (facts: GroundedFactDraft[], extra: Partial<GroundedExtractorOutput> = {}): GroundedExtractorOutput => ({
  facts,
  notFound: [],
  ambiguities: [],
  ...extra,
});

test('mergeFacts dedupes by value and overlapping evidence', () => {
  const m = mergeFacts([out([deadlineAt(10, 30, 'medium', 'q1')]), out([deadlineAt(12, 30, 'high', 'q2')])]);
  expect(m.facts).toHaveLength(1);
  expect(m.facts[0]!.confidence).toBe('high');
  expect(m.facts[0]!.evidence).toHaveLength(2);
});

test('same value without overlapping evidence stays separate', () =>
  expect(
    mergeFacts([out([deadlineAt(10, 30, 'medium', 'q1'), deadlineAt(500, 30, 'medium', 'q2')])]).facts,
  ).toHaveLength(2));

test('unanchored facts merge on the same normalized quote', () =>
  expect(
    mergeFacts([
      out([deadlineAt(null, 30, 'low', 'Prazo de  30 dias')]),
      out([deadlineAt(null, 30, 'low', 'prazo de 30 dias')]),
    ]).facts,
  ).toHaveLength(1));

test('mergeFacts keeps different values and reassigns ids in text order', () => {
  const m = mergeFacts([
    out([deadlineAt(50, 30, 'high', 'q1'), deadlineAt(null, 5, 'high', 'q3'), deadlineAt(10, 15, 'high', 'q2')]),
  ]);
  expect(m.facts.map((f) => [f.id, f.value])).toEqual([
    ['F01', expect.objectContaining({ amount: 15 })],
    ['F02', expect.objectContaining({ amount: 30 })],
    ['F03', expect.objectContaining({ amount: 5 })],
  ]);
});

test('notFound = categories absent in every output and with no merged facts', () => {
  const m = mergeFacts([
    out([deadlineAt(10, 30, 'high', 'q')], { notFound: ['date', 'monetary_value'] }),
    out([], { notFound: ['deadline', 'date'] }),
  ]);
  expect(m.notFound).toEqual(['date', 'monetary_value']);
});

test('ambiguities deduplicated by normalized quote', () => {
  const match = {
    start: null,
    end: null,
    page: null,
    sectionId: null,
    matchType: 'not_found' as const,
    matchScore: null,
  };
  const m = mergeFacts([
    out([], { ambiguities: [{ description: 'a', quote: 'Prazo  X', match }] }),
    out([], { ambiguities: [{ description: 'b', quote: 'prazo x', match }] }),
  ]);
  expect(m.ambiguities).toHaveLength(1);
});

test('valueKey', () => {
  expect(valueKey('monetary_value', { amount: 10, currency: 'BRL', role: 'a' })).toBe(
    valueKey('monetary_value', { amount: 10.001, currency: 'BRL', role: 'b' }),
  );
  expect(
    valueKey('legal_reference', {
      normType: 'lei',
      number: null,
      year: null,
      provision: null,
      citation: 'Lei  13.105',
    }),
  ).toBe(valueKey('legal_reference', { normType: 'x', number: '1', year: 1, provision: null, citation: 'lei 13.105' }));
  expect(valueKey('date', { iso: '2025-01-01', role: 'judgment' })).not.toBe(
    valueKey('date', { iso: '2025-01-01', role: 'publication' }),
  );
});

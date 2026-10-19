import type { Fact, FactCategory, Verdict, VerificationItem } from '@app/shared';
import { computeVerificationMetrics } from './metrics';

const crit = ['decision', 'deadline', 'monetary_value', 'obligation'] as FactCategory[];
const fact = (id: string, category: FactCategory): Fact =>
  ({
    id,
    category,
    label: id,
    value: {},
    evidence: [],
    confidence: 'high',
    status: 'confirmed',
    uncertaintyReasons: [],
  }) as unknown as Fact;
const factItem = (factId: string, verdict: Verdict): VerificationItem => ({
  id: `V-${factId}`,
  direction: 'source_to_summary',
  verdict,
  explanation: '',
  factId,
  claimId: null,
  decidedBy: 'llm',
  usedQuotes: [],
});
const claimItem = (verdict: Verdict): VerificationItem => ({
  ...factItem('x', verdict),
  direction: 'summary_to_source',
  factId: null,
  claimId: 'A01',
});

test('zero denominators give null, never NaN (Review Focus 3)', () =>
  expect(computeVerificationMetrics([], [], crit)).toEqual({
    factualConsistency: null,
    claimSupport: null,
    unverifiableCount: 0,
  }));

test('factual consistency counts only critical facts and leaves unverifiable out', () => {
  const facts = [
    fact('F1', 'decision'),
    fact('F2', 'deadline'),
    fact('F3', 'date'),
    fact('F4', 'obligation'),
    fact('F5', 'monetary_value'),
  ];
  const items = [
    factItem('F1', 'consistent'),
    factItem('F2', 'divergent'),
    factItem('F3', 'omitted'),
    factItem('F4', 'omitted'),
    factItem('F5', 'unverifiable'),
    claimItem('supported'),
    claimItem('supported'),
    claimItem('unsupported'),
    claimItem('unverifiable'),
  ];
  expect(computeVerificationMetrics(items, facts, crit)).toEqual({
    factualConsistency: 1 / 3,
    claimSupport: 2 / 3,
    unverifiableCount: 2,
  });
});

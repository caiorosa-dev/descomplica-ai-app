import type { Direction, FactCategory, Verdict, VerificationItem } from '@app/shared';
import { type SeverityContext, severityFor } from './severity';

const crit = ['decision', 'deadline', 'monetary_value', 'obligation'] as FactCategory[];
const item = (direction: Direction, verdict: Verdict): VerificationItem => ({
  id: 'V001',
  direction,
  verdict,
  explanation: 'x',
  factId: null,
  claimId: null,
  decidedBy: 'llm',
  usedQuotes: [],
});
const sc = (category: FactCategory | null): Partial<SeverityContext> => ({ category });

test.each([
  ['divergent decision', item('source_to_summary', 'divergent'), sc('decision'), 'high'],
  ['divergent date', item('source_to_summary', 'divergent'), sc('date'), 'medium'],
  ['divergent claim about money', item('summary_to_source', 'divergent'), sc('monetary_value'), 'high'],
  ['omitted decision', item('source_to_summary', 'omitted'), sc('decision'), 'high'],
  ['omitted deadline', item('source_to_summary', 'omitted'), sc('deadline'), 'medium'],
  ['omitted legal_reference → no alert', item('source_to_summary', 'omitted'), sc('legal_reference'), null],
  [
    'omitted amendment in amendment doc',
    item('source_to_summary', 'omitted'),
    { ...sc('amendment'), isAmendmentDoc: true },
    'medium',
  ],
  ['omitted amendment elsewhere → no alert', item('source_to_summary', 'omitted'), sc('amendment'), null],
  ['unsupported typed', item('summary_to_source', 'unsupported'), { ...sc('deadline'), hasTypedValue: true }, 'high'],
  ['unsupported untyped', item('summary_to_source', 'unsupported'), sc(null), 'medium'],
  ['unverifiable critical fact', item('source_to_summary', 'unverifiable'), sc('deadline'), 'low'],
  ['unverifiable non-critical fact → no alert', item('source_to_summary', 'unverifiable'), sc('date'), null],
  ['unverifiable claim', item('summary_to_source', 'unverifiable'), sc(null), 'low'],
  ['consistent → no alert', item('source_to_summary', 'consistent'), sc('deadline'), null],
  ['supported → no alert', item('summary_to_source', 'supported'), sc('deadline'), null],
])('severity: %s', (_, it, ctx, sev) =>
  expect(severityFor(it, { critical: crit, isAmendmentDoc: false, hasTypedValue: false, category: null, ...ctx })).toBe(
    sev,
  ),
);

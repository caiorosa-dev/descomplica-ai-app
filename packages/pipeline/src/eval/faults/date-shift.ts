import type { Fact, InjectedFault, Summary } from '@app/shared';
import { findDates } from '../../stages/information-extraction/parsers/dates';
import { rewriteFirst } from './text-slots';

/** Adds one year to the first summary date that matches an extracted date fact, keeping its format. */
export function dateShift(summary: Summary, facts: Fact[]): { summary: Summary; fault: InjectedFault } | null {
  const factDates = new Set(facts.flatMap((f) => (f.category === 'date' ? [f.value.iso] : [])));
  const result = rewriteFirst(summary, findDates, (match, raw) =>
    factDates.has(match.iso)
      ? raw.replace(/(\d{4}|\d{2})$/, (y) =>
          y.length === 4 ? String(Number(y) + 1) : String((Number(y) + 1) % 100).padStart(2, '0'),
        )
      : null,
  );
  if (!result) return null;
  return {
    summary: result.summary,
    fault: {
      type: 'date_shift',
      description: `Data trocada de "${result.before}" para "${result.after}".`,
      expected: { alertType: 'divergence', category: 'date' },
    },
  };
}

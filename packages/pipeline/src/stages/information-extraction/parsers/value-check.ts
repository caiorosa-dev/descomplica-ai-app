import type { CategoryValue, DateValue, DeadlineValue, FactCategory, MonetaryValue } from '@app/shared';
import { findDates } from './dates';
import { findDurations } from './durations';
import { findMoney } from './money';

/** `businessDays: null` on either side is compatible with any value. */
export function sameDuration(
  a: Pick<DeadlineValue, 'amount' | 'unit' | 'businessDays'>,
  b: Pick<DeadlineValue, 'amount' | 'unit' | 'businessDays'>,
): boolean {
  return (
    a.amount === b.amount &&
    a.unit === b.unit &&
    (a.businessDays === null || b.businessDays === null || a.businessDays === b.businessDays)
  );
}

export function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/**
 * Whether the normalized value is written in the quote. Null for categories without a parser
 * (obligation, decision, legal_reference, amendment).
 */
export function valueAppearsIn(category: FactCategory, value: CategoryValue, quote: string): boolean | null {
  switch (category) {
    case 'date':
      return findDates(quote).some((d) => d.iso === (value as DateValue).iso);
    case 'deadline':
      return findDurations(quote).some((d) => sameDuration(d, value as DeadlineValue));
    case 'monetary_value':
      return findMoney(quote).some((m) => sameAmount(m.amount, (value as MonetaryValue).amount));
    default:
      return null;
  }
}

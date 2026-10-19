import type { CategoryValue, Claim, FactCategory, ValueOf } from '@app/shared';
import { findDates } from '../information-extraction/parsers/dates';
import { findDurations } from '../information-extraction/parsers/durations';
import { findMoney } from '../information-extraction/parsers/money';
import { sameAmount, sameDuration } from '../information-extraction/parsers/value-check';

/**
 * For dates, amounts and deadlines, when the claim text has exactly one such entity, the parsed value replaces
 * the one typed by the LLM (non-numeric fields such as role and trigger are kept).
 */
export function retypeClaimValue(claim: Claim): Claim {
  if (!claim.value) return claim;
  switch (claim.category) {
    case 'date': {
      const found = findDates(claim.text);
      return found.length === 1
        ? { ...claim, value: { ...(claim.value as ValueOf<'date'>), iso: found[0]!.iso } }
        : claim;
    }
    case 'monetary_value': {
      const found = findMoney(claim.text);
      return found.length === 1
        ? { ...claim, value: { ...(claim.value as ValueOf<'monetary_value'>), amount: found[0]!.amount } }
        : claim;
    }
    case 'deadline': {
      const found = findDurations(claim.text);
      if (found.length !== 1) return claim;
      const { amount, unit, businessDays } = found[0]!;
      return { ...claim, value: { ...(claim.value as ValueOf<'deadline'>), amount, unit, businessDays } };
    }
    default:
      return claim;
  }
}

const CITATION_SYNONYMS: [RegExp, string][] = [
  [/código de processo civil/g, 'cpc'],
  [/constituição federal/g, 'cf'],
  [/lei complementar/g, 'lc'],
  [/código civil/g, 'cc'],
];

export function normalizeCitation(citation: string): string {
  let s = citation.toLowerCase();
  for (const [re, short] of CITATION_SYNONYMS) s = s.replace(re, short);
  return s
    .replace(/\bn[º°]/g, '')
    .replace(/\bn\.(?=\s|\d)/g, '')
    .replace(/[º°]/g, '')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

/** Deterministic comparison of typed values; categories without a comparable value are 'incomparable'. */
export function compareValues(
  category: FactCategory,
  a: CategoryValue,
  b: CategoryValue,
): 'equal' | 'different' | 'incomparable' {
  const result = (same: boolean) => (same ? 'equal' : 'different');
  switch (category) {
    case 'date':
      return result((a as ValueOf<'date'>).iso === (b as ValueOf<'date'>).iso);
    case 'deadline':
      return result(sameDuration(a as ValueOf<'deadline'>, b as ValueOf<'deadline'>));
    case 'monetary_value':
      return result(sameAmount((a as ValueOf<'monetary_value'>).amount, (b as ValueOf<'monetary_value'>).amount));
    case 'legal_reference':
      return result(
        normalizeCitation((a as ValueOf<'legal_reference'>).citation) ===
          normalizeCitation((b as ValueOf<'legal_reference'>).citation),
      );
    default:
      return 'incomparable';
  }
}

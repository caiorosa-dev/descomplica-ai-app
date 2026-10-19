import type { FactCategory, Severity, VerificationItem } from '@app/shared';

export interface SeverityContext {
  category: FactCategory | null;
  hasTypedValue: boolean;
  isAmendmentDoc: boolean;
  critical: FactCategory[];
}

const HIGH_DIVERGENCE: FactCategory[] = ['decision', 'monetary_value', 'deadline'];

/** Severity matrix of spec §6.5; null means the item does not raise an alert. */
export function severityFor(item: VerificationItem, ctx: SeverityContext): Severity | null {
  const critical = ctx.isAmendmentDoc ? [...ctx.critical, 'amendment'] : ctx.critical;
  const isCritical = ctx.category !== null && critical.includes(ctx.category);
  switch (item.verdict) {
    case 'divergent':
      return ctx.category && HIGH_DIVERGENCE.includes(ctx.category) ? 'high' : 'medium';
    case 'unsupported':
      return ctx.hasTypedValue ? 'high' : 'medium';
    case 'omitted':
      if (!isCritical) return null;
      return ctx.category === 'decision' ? 'high' : 'medium';
    case 'unverifiable':
      if (item.direction === 'summary_to_source') return 'low';
      return isCritical ? 'low' : null;
    default:
      return null;
  }
}

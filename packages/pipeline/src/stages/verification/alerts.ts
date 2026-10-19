import type { Alert, AlertType, Claim, Fact, FactCategory, Severity, Verdict, VerificationItem } from '@app/shared';
import { CATEGORY_LABELS } from './labels';
import { severityFor } from './severity';

const TYPE_BY_VERDICT: Partial<Record<Verdict, AlertType>> = {
  divergent: 'divergence',
  omitted: 'omission',
  unsupported: 'unsupported_claim',
  unverifiable: 'unverifiable',
};
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function title(type: AlertType, label: string): string {
  switch (type) {
    case 'divergence':
      return `Divergência em ${label}`;
    case 'omission':
      return `Omissão: ${label}`;
    case 'unsupported_claim':
      return 'Afirmação sem respaldo no documento';
    case 'unverifiable':
      return `Não foi possível verificar: ${label}`;
  }
}

/** Alerts for the items the severity matrix flags, ordered by severity then by item id (ids AL01, AL02, ...). */
export function buildAlerts(
  items: VerificationItem[],
  facts: Fact[],
  claims: Claim[],
  opts: { critical: FactCategory[]; isAmendmentDoc: boolean },
): Alert[] {
  const factById = new Map(facts.map((f) => [f.id, f]));
  const claimById = new Map(claims.map((c) => [c.id, c]));
  const raw: { item: VerificationItem; alert: Omit<Alert, 'id'> }[] = [];
  for (const item of items) {
    const type = TYPE_BY_VERDICT[item.verdict];
    if (!type) continue;
    const fact = item.factId ? factById.get(item.factId) : undefined;
    const claim = item.claimId ? claimById.get(item.claimId) : undefined;
    const category =
      item.direction === 'source_to_summary' ? (fact?.category ?? null) : (claim?.category ?? fact?.category ?? null);
    const severity = severityFor(item, {
      category,
      hasTypedValue: claim?.value != null,
      isAmendmentDoc: opts.isAmendmentDoc,
      critical: opts.critical,
    });
    if (!severity) continue;
    const label = fact?.label ?? (category ? CATEGORY_LABELS[category] : 'afirmação do resumo');
    raw.push({
      item,
      alert: {
        type,
        severity,
        category,
        title: title(type, label),
        explanation: item.explanation,
        sourceFactId: item.factId,
        claimId: item.claimId,
        sourceEvidence: (item.direction === 'source_to_summary' || item.verdict === 'divergent'
          ? (fact?.evidence ?? [])
          : []
        )
          .filter((e) => e.start !== null && e.end !== null)
          .map((e) => ({ start: e.start as number, end: e.end as number, page: e.page })),
        summaryRef: claim?.paragraphRef ?? null,
      },
    });
  }
  return raw
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.alert.severity] - SEVERITY_ORDER[b.alert.severity] || a.item.id.localeCompare(b.item.id),
    )
    .map(({ alert }, i) => ({ id: `AL${String(i + 1).padStart(2, '0')}`, ...alert }));
}

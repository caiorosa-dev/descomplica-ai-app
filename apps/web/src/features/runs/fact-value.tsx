import type { Claim, FactCategory, ValueOf } from '@app/shared';
import { formatCurrencyBRL, formatDate } from '@/lib/format';
import {
  CHANGE_TYPE_LABELS,
  DATE_ROLE_LABELS,
  MODALITY_LABELS,
  OUTCOME_LABELS,
  UNANIMITY_LABELS,
  UNIT_LABELS,
} from '@/lib/labels';

type Valued = { [K in FactCategory]: { category: K; value: ValueOf<K> } }[FactCategory];

/** A typed fact (or claim) value written in pt-BR, according to its category. */
export function formatFactValue({ category, value }: Valued): string {
  switch (category) {
    case 'date':
      return `${formatDate(value.iso)} (${DATE_ROLE_LABELS[value.role]})`;
    case 'deadline': {
      const unit = UNIT_LABELS[value.unit][value.amount === 1 ? 0 : 1];
      const kind = value.businessDays === true ? ' úteis' : value.businessDays === false ? ' corridos' : '';
      return `${value.amount} ${unit}${kind}${value.trigger ? `, a partir de ${value.trigger}` : ''}`;
    }
    case 'monetary_value':
      return formatCurrencyBRL(value.amount);
    case 'obligation':
      return `${value.bearer} ${MODALITY_LABELS[value.modality]} ${value.action}${value.condition ? ` (${value.condition})` : ''}`;
    case 'decision': {
      const unanimity = UNANIMITY_LABELS[value.unanimity];
      return unanimity ? `${OUTCOME_LABELS[value.outcome]} (${unanimity})` : OUTCOME_LABELS[value.outcome];
    }
    case 'legal_reference':
      return value.citation;
    case 'amendment':
      return `${CHANGE_TYPE_LABELS[value.changeType]} ${value.targetProvision} de ${value.targetAct}`;
  }
}

export function FactValue({ fact }: { fact: Valued }) {
  return <span>{formatFactValue(fact)}</span>;
}

export function claimAsValued(claim: Claim): Valued | null {
  return claim.category && claim.value ? ({ category: claim.category, value: claim.value } as Valued) : null;
}

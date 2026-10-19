import type { FactCategory, UncertaintyReason, ValueOf } from '@app/shared';

export const CATEGORY_LABELS: Record<FactCategory, string> = {
  date: 'data',
  deadline: 'prazo',
  monetary_value: 'valor',
  obligation: 'obrigação',
  decision: 'decisão',
  legal_reference: 'referência legal',
  amendment: 'alteração normativa',
};

export const UNCERTAINTY_LABELS: Record<UncertaintyReason, string> = {
  quote_not_found: 'citação não encontrada no texto',
  value_mismatch: 'valor não confere com a citação',
  low_confidence: 'baixa confiança',
  ambiguous: 'trecho ambíguo',
};

export const DATE_ROLE_LABELS: Record<ValueOf<'date'>['role'], string> = {
  judgment: 'julgamento',
  publication: 'publicação',
  effective: 'vigência',
  signature: 'assinatura',
  filing: 'protocolo',
  other: 'outra',
};

export const UNIT_LABELS: Record<ValueOf<'deadline'>['unit'], [string, string]> = {
  days: ['dia', 'dias'],
  months: ['mês', 'meses'],
  years: ['ano', 'anos'],
};

export const OUTCOME_LABELS: Record<ValueOf<'decision'>['outcome'], string> = {
  granted: 'provido',
  partially_granted: 'parcialmente provido',
  denied: 'negado',
  not_heard: 'não conhecido',
  other: 'outro resultado',
};

export const MODALITY_LABELS: Record<ValueOf<'obligation'>['modality'], string> = {
  must: 'deve',
  must_not: 'não deve',
  may: 'pode',
};

export const CHANGE_LABELS: Record<ValueOf<'amendment'>['changeType'], string> = {
  added: 'acrescentou',
  amended: 'alterou',
  revoked: 'revogou',
};

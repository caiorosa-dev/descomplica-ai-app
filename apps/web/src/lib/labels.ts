import type {
  AlertType,
  Confidence,
  DocumentType,
  FactCategory,
  FactStatus,
  RunStatus,
  Severity,
  StageName,
  StageRunStatus,
  UncertaintyReason,
  Verdict,
} from '@app/shared';

export const STAGE_LABELS: Record<StageName, string> = {
  text_extraction: 'Extração e limpeza',
  information_extraction: 'Extração de informações',
  summarization: 'Resumo',
  similarity: 'Similaridade',
  verification: 'Verificação',
  report: 'Relatório',
};

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  queued: 'Na fila',
  running: 'Em andamento',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  interrupted: 'Interrompida',
};

export const STAGE_RUN_STATUS_LABELS: Record<StageRunStatus, string> = {
  pending: 'Pendente',
  running: 'Rodando',
  completed: 'Concluída',
  failed: 'Falhou',
  reused: 'Reaproveitada',
  overridden: 'Substituída',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  court_decision: 'Decisão judicial',
  normative_act: 'Ato normativo',
  generic: 'Outro',
};

export const CATEGORY_LABELS: Record<FactCategory, string> = {
  date: 'Datas',
  deadline: 'Prazos',
  monetary_value: 'Valores',
  obligation: 'Obrigações',
  decision: 'Decisão',
  legal_reference: 'Referências legais',
  amendment: 'Alterações normativas',
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };

export const FACT_STATUS_LABELS: Record<FactStatus, string> = { confirmed: 'Confirmado', uncertain: 'Incerto' };

export const UNCERTAINTY_REASON_LABELS: Record<UncertaintyReason, string> = {
  quote_not_found: 'Citação não encontrada no texto',
  value_mismatch: 'Valor não confere com a citação',
  low_confidence: 'Baixa confiança do modelo',
  ambiguous: 'Trecho ambíguo',
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  consistent: 'Consistente',
  divergent: 'Divergente',
  omitted: 'Omitido',
  unverifiable: 'Não verificável',
  supported: 'Com respaldo',
  unsupported: 'Sem respaldo',
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  divergence: 'Divergência',
  omission: 'Omissão',
  unsupported_claim: 'Afirmação sem respaldo',
  unverifiable: 'Não verificável',
};

export const SEVERITY_LABELS: Record<Severity, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

export const DATE_ROLE_LABELS = {
  judgment: 'julgamento',
  publication: 'publicação',
  effective: 'vigência',
  signature: 'assinatura',
  filing: 'protocolo',
  other: 'outra',
} as const;

export const OUTCOME_LABELS = {
  granted: 'Provido',
  partially_granted: 'Parcialmente provido',
  denied: 'Negado',
  not_heard: 'Não conhecido',
  other: 'Outro resultado',
} as const;

export const UNANIMITY_LABELS = { unanimous: 'unânime', majority: 'por maioria', unknown: null } as const;

export const MODALITY_LABELS = { must: 'deve', must_not: 'não deve', may: 'pode' } as const;

export const CHANGE_TYPE_LABELS = { added: 'acrescentou', amended: 'alterou', revoked: 'revogou' } as const;

export const UNIT_LABELS = { days: ['dia', 'dias'], months: ['mês', 'meses'], years: ['ano', 'anos'] } as const;

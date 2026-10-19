import { z } from 'zod';

export const StageName = z.enum([
  'text_extraction',
  'information_extraction',
  'summarization',
  'similarity',
  'verification',
  'report',
]);
export type StageName = z.infer<typeof StageName>;

export const STAGE_ORDER: readonly StageName[] = StageName.options;

export function stageIndex(stage: StageName): number {
  return STAGE_ORDER.indexOf(stage);
}

export const RunStatus = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted']);
export type RunStatus = z.infer<typeof RunStatus>;

export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = ['completed', 'failed', 'cancelled', 'interrupted'];

export const StageRunStatus = z.enum(['pending', 'running', 'completed', 'failed', 'reused', 'overridden']);
export type StageRunStatus = z.infer<typeof StageRunStatus>;

export const DocumentSource = z.enum(['upload', 'corpus']);
export type DocumentSource = z.infer<typeof DocumentSource>;

export const SourceFormat = z.enum(['pdf', 'html', 'docx', 'txt']);
export type SourceFormat = z.infer<typeof SourceFormat>;

export const DocumentType = z.enum(['court_decision', 'normative_act', 'generic']);
export type DocumentType = z.infer<typeof DocumentType>;

export const DocumentSubtype = z.enum(['amendment']);
export type DocumentSubtype = z.infer<typeof DocumentSubtype>;

export const SectionKind = z.enum([
  'preamble',
  'headnote',
  'judgment',
  'report',
  'vote',
  'operative_part',
  'judgment_certificate',
  'recitals',
  'article',
  'annex',
  'paragraph',
]);
export type SectionKind = z.infer<typeof SectionKind>;

export const FactCategory = z.enum([
  'date',
  'deadline',
  'monetary_value',
  'obligation',
  'decision',
  'legal_reference',
  'amendment',
]);
export type FactCategory = z.infer<typeof FactCategory>;

export const Confidence = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof Confidence>;

export function confidenceRank(confidence: Confidence): 0 | 1 | 2 {
  return confidence === 'low' ? 0 : confidence === 'medium' ? 1 : 2;
}

export const FactStatus = z.enum(['confirmed', 'uncertain']);
export type FactStatus = z.infer<typeof FactStatus>;

export const UncertaintyReason = z.enum(['quote_not_found', 'value_mismatch', 'low_confidence', 'ambiguous']);
export type UncertaintyReason = z.infer<typeof UncertaintyReason>;

export const MatchType = z.enum(['exact', 'fuzzy', 'not_found']);
export type MatchType = z.infer<typeof MatchType>;

export const Direction = z.enum(['source_to_summary', 'summary_to_source']);
export type Direction = z.infer<typeof Direction>;

export const Verdict = z.enum(['consistent', 'divergent', 'omitted', 'unverifiable', 'supported', 'unsupported']);
export type Verdict = z.infer<typeof Verdict>;

export const SOURCE_VERDICTS: readonly Verdict[] = ['consistent', 'divergent', 'omitted', 'unverifiable'];
export const CLAIM_VERDICTS: readonly Verdict[] = ['supported', 'divergent', 'unsupported', 'unverifiable'];

export const AlertType = z.enum(['divergence', 'omission', 'unsupported_claim', 'unverifiable']);
export type AlertType = z.infer<typeof AlertType>;

export const Severity = z.enum(['high', 'medium', 'low']);
export type Severity = z.infer<typeof Severity>;

export const DecidedBy = z.enum(['code', 'llm']);
export type DecidedBy = z.infer<typeof DecidedBy>;

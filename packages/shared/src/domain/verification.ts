import { z } from 'zod';
import { AlertType, DecidedBy, Direction, FactCategory, Severity, Verdict } from './enums';
import { CategoryValue, DateValue, DeadlineValue, DecisionValue, LegalReferenceValue, MonetaryValue } from './facts';

export const ParagraphRef = z.object({
  sectionIndex: z.number().int(),
  paragraphIndex: z.number().int(),
});
export type ParagraphRef = z.infer<typeof ParagraphRef>;

const claimCommon = { text: z.string(), paragraphIndexInInput: z.number().int() };

/** Claim as produced by the claim extractor (LLM output). Typed categories follow spec §6.5. */
export const ClaimDraft = z.discriminatedUnion('category', [
  z.object({ ...claimCommon, category: z.literal('date'), value: DateValue }),
  z.object({ ...claimCommon, category: z.literal('deadline'), value: DeadlineValue }),
  z.object({ ...claimCommon, category: z.literal('monetary_value'), value: MonetaryValue }),
  z.object({ ...claimCommon, category: z.literal('decision'), value: DecisionValue }),
  z.object({ ...claimCommon, category: z.literal('legal_reference'), value: LegalReferenceValue }),
  z.object({ ...claimCommon, category: z.literal('untyped'), value: z.null() }),
]);
export type ClaimDraft = z.infer<typeof ClaimDraft>;

export const Claim = z.object({
  id: z.string(),
  text: z.string(),
  paragraphRef: ParagraphRef.nullable(),
  category: FactCategory.nullable(),
  value: CategoryValue.nullable(),
});
export type Claim = z.infer<typeof Claim>;

export const VerificationItem = z.object({
  id: z.string(),
  direction: Direction,
  verdict: Verdict,
  explanation: z.string(),
  factId: z.string().nullable(),
  claimId: z.string().nullable(),
  decidedBy: DecidedBy,
  usedQuotes: z.array(z.string()),
});
export type VerificationItem = z.infer<typeof VerificationItem>;

export const SourceSpan = z.object({
  start: z.number().int(),
  end: z.number().int(),
  page: z.number().int().nullable(),
});
export type SourceSpan = z.infer<typeof SourceSpan>;

export const Alert = z.object({
  id: z.string(),
  type: AlertType,
  severity: Severity,
  category: FactCategory.nullable(),
  title: z.string(),
  explanation: z.string(),
  sourceFactId: z.string().nullable(),
  claimId: z.string().nullable(),
  sourceEvidence: z.array(SourceSpan),
  summaryRef: ParagraphRef.nullable(),
});
export type Alert = z.infer<typeof Alert>;

export const VerificationMetrics = z.object({
  factualConsistency: z.number().nullable(),
  claimSupport: z.number().nullable(),
  unverifiableCount: z.number().int(),
});
export type VerificationMetrics = z.infer<typeof VerificationMetrics>;

export const VerificationOutput = z.object({
  claims: z.array(Claim),
  items: z.array(VerificationItem),
  alerts: z.array(Alert),
  metrics: VerificationMetrics,
});
export type VerificationOutput = z.infer<typeof VerificationOutput>;

import { z } from 'zod';
import { Classification, Section } from './document';
import { Confidence, FactCategory, FactStatus, MatchType, UncertaintyReason } from './enums';

export const DateValue = z.object({
  iso: z.string(),
  role: z.enum(['judgment', 'publication', 'effective', 'signature', 'filing', 'other']),
});
export type DateValue = z.infer<typeof DateValue>;

export const DeadlineValue = z.object({
  amount: z.number(),
  unit: z.enum(['days', 'months', 'years']),
  businessDays: z.boolean().nullable(),
  trigger: z.string().nullable(),
});
export type DeadlineValue = z.infer<typeof DeadlineValue>;

export const MonetaryValue = z.object({
  amount: z.number(),
  currency: z.enum(['BRL']),
  role: z.string(),
});
export type MonetaryValue = z.infer<typeof MonetaryValue>;

export const ObligationValue = z.object({
  bearer: z.string(),
  action: z.string(),
  modality: z.enum(['must', 'must_not', 'may']),
  condition: z.string().nullable(),
});
export type ObligationValue = z.infer<typeof ObligationValue>;

export const DecisionValue = z.object({
  outcome: z.enum(['granted', 'partially_granted', 'denied', 'not_heard', 'other']),
  description: z.string(),
  unanimity: z.enum(['unanimous', 'majority', 'unknown']),
});
export type DecisionValue = z.infer<typeof DecisionValue>;

export const LegalReferenceValue = z.object({
  normType: z.string(),
  number: z.string().nullable(),
  year: z.number().int().nullable(),
  provision: z.string().nullable(),
  citation: z.string(),
});
export type LegalReferenceValue = z.infer<typeof LegalReferenceValue>;

export const AmendmentValue = z.object({
  targetAct: z.string(),
  targetProvision: z.string(),
  changeType: z.enum(['added', 'amended', 'revoked']),
  newText: z.string().nullable(),
});
export type AmendmentValue = z.infer<typeof AmendmentValue>;

export const CATEGORY_VALUE_SCHEMAS = {
  date: DateValue,
  deadline: DeadlineValue,
  monetary_value: MonetaryValue,
  obligation: ObligationValue,
  decision: DecisionValue,
  legal_reference: LegalReferenceValue,
  amendment: AmendmentValue,
} as const satisfies Record<FactCategory, z.ZodType>;

export type ValueOf<C extends FactCategory> = z.infer<(typeof CATEGORY_VALUE_SCHEMAS)[C]>;

export const CategoryValue = z.union([
  DateValue,
  DeadlineValue,
  MonetaryValue,
  ObligationValue,
  DecisionValue,
  LegalReferenceValue,
  AmendmentValue,
]);
export type CategoryValue = z.infer<typeof CategoryValue>;

/**
 * One plain object per category, sharing `common`, so the union is a flat discriminated union
 * (never `allOf`), as required by OpenAI strict structured outputs.
 */
function factVariants<const S extends z.ZodRawShape>(common: S) {
  return [
    z.object({ ...common, category: z.literal('date'), value: DateValue }),
    z.object({ ...common, category: z.literal('deadline'), value: DeadlineValue }),
    z.object({ ...common, category: z.literal('monetary_value'), value: MonetaryValue }),
    z.object({ ...common, category: z.literal('obligation'), value: ObligationValue }),
    z.object({ ...common, category: z.literal('decision'), value: DecisionValue }),
    z.object({ ...common, category: z.literal('legal_reference'), value: LegalReferenceValue }),
    z.object({ ...common, category: z.literal('amendment'), value: AmendmentValue }),
  ] as const;
}

export const Evidence = z.object({ quote: z.string() });
export type Evidence = z.infer<typeof Evidence>;

/** Fact as produced by an extractor (LLM output). */
export const FactDraft = z.discriminatedUnion(
  'category',
  factVariants({ id: z.string(), label: z.string(), evidence: z.array(Evidence).min(1), confidence: Confidence }),
);
export type FactDraft = z.infer<typeof FactDraft>;

export const GroundedEvidence = z.object({
  quote: z.string(),
  start: z.number().int().nullable(),
  end: z.number().int().nullable(),
  page: z.number().int().nullable(),
  sectionId: z.string().nullable(),
  matchType: MatchType,
  matchScore: z.number().nullable(),
});
export type GroundedEvidence = z.infer<typeof GroundedEvidence>;

const groundedCommon = {
  id: z.string(),
  label: z.string(),
  evidence: z.array(GroundedEvidence).min(1),
  confidence: Confidence,
};

export const GroundedFactDraft = z.discriminatedUnion('category', factVariants(groundedCommon));
export type GroundedFactDraft = z.infer<typeof GroundedFactDraft>;

export const Fact = z.discriminatedUnion(
  'category',
  factVariants({ ...groundedCommon, status: FactStatus, uncertaintyReasons: z.array(UncertaintyReason) }),
);
export type Fact = z.infer<typeof Fact>;

export const Ambiguity = z.object({ description: z.string(), quote: z.string() });
export type Ambiguity = z.infer<typeof Ambiguity>;

export const ExtractorOutput = z.object({
  facts: z.array(FactDraft),
  notFound: z.array(FactCategory),
  ambiguities: z.array(Ambiguity),
});
export type ExtractorOutput = z.infer<typeof ExtractorOutput>;

export const InformationExtractionOutput = z.object({
  classification: Classification,
  sections: z.array(Section),
  facts: z.array(Fact),
  notFound: z.array(FactCategory),
  ambiguities: z.array(Ambiguity),
});
export type InformationExtractionOutput = z.infer<typeof InformationExtractionOutput>;

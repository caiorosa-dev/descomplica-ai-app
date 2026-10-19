import { z } from 'zod';
import { Confidence, DocumentSubtype, DocumentType, SectionKind, SourceFormat } from './enums';

export const Section = z.object({
  id: z.string(),
  kind: SectionKind,
  label: z.string(),
  parentLabel: z.string().nullable(),
  start: z.number().int(),
  end: z.number().int(),
});
export type Section = z.infer<typeof Section>;

/** Structured output of the classifier (OpenAI strict mode: every field required, optional ones nullable). */
export const Classification = z.object({
  documentType: DocumentType,
  subtype: DocumentSubtype.nullable(),
  confidence: Confidence,
  rationale: z.string(),
  metadata: z.object({
    issuer: z.string().nullable(),
    identifier: z.string().nullable(),
    date: z.string().nullable(),
    judgingBody: z.string().nullable(),
    rapporteur: z.string().nullable(),
  }),
});
export type Classification = z.infer<typeof Classification>;

export const PageRange = z.object({
  page: z.number().int(),
  start: z.number().int(),
  end: z.number().int(),
});
export type PageRange = z.infer<typeof PageRange>;

export const RemovedLine = z.object({
  rule: z.string(),
  page: z.number().int().nullable(),
  text: z.string(),
});
export type RemovedLine = z.infer<typeof RemovedLine>;

export const CleaningReport = z.object({
  removed: z.array(RemovedLine),
  charsBefore: z.number().int(),
  charsAfter: z.number().int(),
  removedByRule: z.array(z.object({ rule: z.string(), count: z.number().int() })),
});
export type CleaningReport = z.infer<typeof CleaningReport>;

export const TextExtractionOutput = z.object({
  sourceFormat: SourceFormat,
  canonicalText: z.string(),
  pageMap: z.array(PageRange),
  cleaningReport: CleaningReport,
  stats: z.object({
    pages: z.number().int(),
    words: z.number().int(),
    estimatedTokens: z.number().int(),
  }),
});
export type TextExtractionOutput = z.infer<typeof TextExtractionOutput>;

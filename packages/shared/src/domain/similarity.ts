import { z } from 'zod';

export const Chunk = z.object({
  id: z.string(),
  start: z.number().int(),
  end: z.number().int(),
  tokens: z.number().int(),
});
export type Chunk = z.infer<typeof Chunk>;

export const SummaryChunk = z.object({
  id: z.string(),
  text: z.string(),
  tokens: z.number().int(),
  sectionIndex: z.number().int().nullable(),
  paragraphIndex: z.number().int().nullable(),
});
export type SummaryChunk = z.infer<typeof SummaryChunk>;

export const SimilarityMetrics = z.object({
  centroid: z.number(),
  coverage: z.number(),
  support: z.number(),
  alignmentF1: z.number(),
});
export type SimilarityMetrics = z.infer<typeof SimilarityMetrics>;

export const SimilarityHeadline = z.enum(['centroid', 'coverage', 'support', 'alignment_f1']);
export type SimilarityHeadline = z.infer<typeof SimilarityHeadline>;

const ScoredChunk = z.object({ chunkId: z.string(), score: z.number(), highlighted: z.boolean() });

export const SimilarityOutput = z.object({
  sourceChunks: z.array(Chunk),
  summaryChunks: z.array(SummaryChunk),
  metrics: SimilarityMetrics,
  headline: z.object({ metric: SimilarityHeadline, value: z.number() }),
  coverageByChunk: z.array(ScoredChunk),
  supportByParagraph: z.array(ScoredChunk),
});
export type SimilarityOutput = z.infer<typeof SimilarityOutput>;

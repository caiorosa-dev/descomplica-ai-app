import { z } from 'zod';

export const Summary = z.object({
  title: z.string(),
  overview: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      paragraphs: z.array(z.object({ text: z.string(), factRefs: z.array(z.string()) })),
    }),
  ),
  glossary: z.array(z.object({ term: z.string(), explanation: z.string() })),
});
export type Summary = z.infer<typeof Summary>;

export const SummarizationOutput = z.object({
  summary: Summary,
  readability: z.object({ source: z.number(), summary: z.number() }),
  compressionRatio: z.number(),
});
export type SummarizationOutput = z.infer<typeof SummarizationOutput>;

import { z } from 'zod';
import { DocumentSubtype } from './domain/enums';

/** One document of the evaluation corpus (spec §13.1). `file` is relative to the corpus directory. */
export const CorpusManifestEntry = z.object({
  key: z.string().regex(/^(stj|cnj)-[a-z0-9-]+$/),
  file: z.string().regex(/^(stj|cnj)\/[a-z0-9-]+\.(pdf|html|docx|txt)$/),
  issuer: z.enum(['STJ', 'CNJ']),
  title: z.string(),
  expectedType: z.enum(['court_decision', 'normative_act']),
  expectedSubtype: DocumentSubtype.nullable(),
  version: z.enum(['original', 'compiled']),
  officialUrl: z.string().url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.string(),
});
export type CorpusManifestEntry = z.infer<typeof CorpusManifestEntry>;

export function parseCorpusManifest(json: unknown): CorpusManifestEntry[] {
  return z
    .array(CorpusManifestEntry)
    .superRefine((entries, ctx) => {
      const seen = new Set<string>();
      for (const [i, e] of entries.entries()) {
        if (seen.has(e.key)) ctx.addIssue({ code: 'custom', path: [i, 'key'], message: `Chave duplicada: ${e.key}` });
        seen.add(e.key);
      }
    })
    .parse(json);
}

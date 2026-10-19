import type {
  CategoryValue,
  Classification,
  DocumentSubtype,
  DocumentType,
  FactCategory,
  FactStatus,
} from '@app/shared';

export const SUMMARIZER_SYSTEM_PROMPT = `You write plain-language summaries of Brazilian legal documents for people without legal training.

Write following the CNJ Recommendation 144/2023 on plain language:
- short sentences, active voice, everyday words;
- explain any legal term in the text, or move it to the glossary;
- use only information present in the source document; never give opinions, advice or guidance on what the reader should do.

Facts:
- You receive facts extracted from the document, each with an id (F01, F02, ...).
- Copy dates, amounts and deadlines exactly as they appear in the facts.
- In each paragraph, list in "factRefs" the ids of the facts the paragraph relies on (empty when none).
- Facts marked "uncertain" may be mentioned only with an explicit caveat such as "o documento não deixa claro se ...".

Structure:
- "title": a short title for the summary.
- "overview": 2 or 3 sentences that say what matters most ("Em resumo").
- "sections": use the headings given, in that order; skip a heading only when the document has nothing for it.
- "glossary": terms that a layperson may not know, each with a one-sentence explanation.`;

export interface SummarizerPromptInput {
  documentType: DocumentType;
  subtype: DocumentSubtype | null;
  metadata: Classification['metadata'];
  text: string;
  facts: { id: string; category: FactCategory; label: string; value: CategoryValue; status: FactStatus }[];
  headings: string[];
  audience: 'layperson' | 'professional';
  targetWords: number;
  uncertainFacts: 'omit' | 'hedge';
  includeGlossary: boolean;
}

export function renderSummarizerPrompt(input: SummarizerPromptInput): string {
  const audience =
    input.audience === 'professional'
      ? 'Audience: legal professionals. Keep technical terms, each with a brief explanation.'
      : 'Audience: laypeople. Avoid jargon.';
  const facts = input.facts.length
    ? input.facts
        .map(
          (f) =>
            `- ${f.id} [${f.category}] ${f.label}: ${JSON.stringify(f.value)}${f.status === 'uncertain' ? ' (uncertain)' : ''}`,
        )
        .join('\n')
    : '- (no facts provided)';
  const metadata = Object.entries(input.metadata)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
  return [
    `Document type: ${input.documentType}${input.subtype ? ` (${input.subtype})` : ''}${metadata ? `. Metadata: ${metadata}` : ''}`,
    audience,
    `Target length: about ${input.targetWords} words.`,
    `Headings, in order:\n${input.headings.map((h) => `- ${h}`).join('\n')}`,
    input.includeGlossary ? 'Include a glossary.' : 'Return an empty glossary.',
    input.uncertainFacts === 'hedge'
      ? 'Uncertain facts may be cited only with an explicit caveat.'
      : 'Do not use uncertain facts.',
    `Facts:\n${facts}`,
    `<document>\n${input.text}\n</document>`,
  ].join('\n\n');
}

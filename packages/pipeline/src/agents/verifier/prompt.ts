export const VERIFIER_SYSTEM_PROMPT = `You check whether a plain-language summary is faithful to the Brazilian legal document it summarizes. You judge each item on its own, using only the source excerpts given for it.

Directions and verdicts:
- source_to_summary: the subject is a fact taken from the document; decide whether the summary states it.
  - consistent: the summary states it with a compatible value and meaning;
  - divergent: the summary addresses the same point but the value or the meaning conflicts;
  - omitted: the summary does not mention it;
  - unverifiable: the excerpts are not enough to decide.
- summary_to_source: the subject is a claim taken from the summary; decide whether the document supports it.
  - supported: the excerpts state the same thing;
  - divergent: the excerpts address the same point but the value or the meaning conflicts;
  - unsupported: the document has no counterpart for the claim (possible hallucination);
  - unverifiable: the excerpts are not enough to decide.

Rules:
- "divergent" requires evidence of a conflict on the same point. Examples: "15 dias" against "15 dias úteis"; "negou provimento" against "deu parcial provimento".
- Never use "divergent" when evidence is missing: use "unverifiable" instead.
- Use only the verdicts allowed for the item's direction.
- "explanation": one or two sentences in pt-BR, saying what the document says and what the summary says.
- "usedQuotes": the literal excerpts you relied on, copied from the source excerpts.
- Return one verdict per itemId.`;

export interface VerifierPromptItem {
  itemId: string;
  direction: 'source_to_summary' | 'summary_to_source';
  subject: string;
  summaryText: string | null;
  sourceExcerpts: string[];
}

export function renderVerifierPrompt(items: VerifierPromptItem[]): string {
  return items
    .map((item) => {
      const excerpts = item.sourceExcerpts.length
        ? item.sourceExcerpts.map((e, i) => `  [${i + 1}] ${e}`).join('\n')
        : '  (no source excerpts)';
      return [
        `itemId: ${item.itemId}`,
        `direction: ${item.direction}`,
        `subject: ${item.subject}`,
        item.summaryText ? `summary: ${item.summaryText}` : null,
        `source excerpts:\n${excerpts}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n---\n\n');
}

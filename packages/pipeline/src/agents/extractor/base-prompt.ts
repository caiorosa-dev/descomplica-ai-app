import type { DocumentSubtype, DocumentType, FactCategory, SectionKind } from '@app/shared';

export const BASE_EXTRACTION_RULES = `You extract critical facts from a Brazilian legal document for a plain-language summary.

Rules:
- Extract only what the text states explicitly. Never infer, compute or complete dates, amounts or deadlines.
- Every fact needs at least one evidence quote: the shortest literal excerpt of the document that supports it, copied character by character (same spelling, accents, punctuation and numbers). Do not paraphrase, translate, fix typos or join distant passages.
- Extract only the requested categories, one fact per distinct piece of information.
- When unsure, use confidence "low" and also describe the doubt in "ambiguities" with the literal quote that causes it.
- List in "notFound" every requested category for which the document has no fact.
- "label" is a short description in pt-BR (for example "Data do julgamento", "Prazo para recorrer").
- Use ids F01, F02, ... in order of appearance.

Value formats by category:
- date: { iso: "YYYY-MM-DD", role: judgment | publication | effective | signature | filing | other }
- deadline: { amount, unit: days | months | years, businessDays: true for "dias úteis", false for "dias corridos", null when not stated, trigger: the event that starts the count or null }
- monetary_value: { amount in reais as a number (R$ 10 mil = 10000), currency: "BRL", role: what the amount is }
- obligation: { bearer: who must act, action: what must (or must not / may) be done, modality: must | must_not | may, condition: or null }
- decision: { outcome: granted | partially_granted | denied | not_heard | other, description, unanimity: unanimous | majority | unknown }
- legal_reference: { normType (e.g. "Lei", "Resolução CNJ", "Código de Processo Civil"), number or null, year or null, provision (article/paragraph) or null, citation as written }
- amendment: { targetAct, targetProvision, changeType: added | amended | revoked, newText or null }`;

export interface ExtractorPromptInput {
  documentType: DocumentType;
  subtype: DocumentSubtype | null;
  text: string;
  sections: { id: string; kind: SectionKind; label: string }[];
  categories: FactCategory[];
}

export function renderExtractorPrompt(input: ExtractorPromptInput): string {
  const sections = input.sections.map((s) => `- ${s.id} (${s.kind}): ${s.label}`).join('\n') || '- (none)';
  return [
    `Document type: ${input.documentType}${input.subtype ? ` (subtype: ${input.subtype})` : ''}`,
    `Requested categories: ${input.categories.join(', ')}`,
    `Sections:\n${sections}`,
    `<document>\n${input.text}\n</document>`,
  ].join('\n\n');
}

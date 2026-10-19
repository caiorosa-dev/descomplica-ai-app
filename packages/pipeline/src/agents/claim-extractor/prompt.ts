export const CLAIM_EXTRACTOR_SYSTEM_PROMPT = `You break a plain-language summary of a Brazilian legal document into atomic claims, so that each claim can be checked against the source document.

Rules:
- A claim is one verifiable statement taken from one paragraph. Split sentences that state several things.
- Keep the wording of the summary; do not add information.
- "paragraphIndexInInput" is the [index] of the paragraph the claim comes from.
- Type the claim's value when it states a date, a deadline, an amount of money, a court decision or a legal reference, using:
  - date: { iso: "YYYY-MM-DD", role: judgment | publication | effective | signature | filing | other }
  - deadline: { amount, unit: days | months | years, businessDays: true/false/null, trigger or null }
  - monetary_value: { amount in reais (R$ 10 mil = 10000), currency: "BRL", role }
  - decision: { outcome: granted | partially_granted | denied | not_heard | other, description, unanimity: unanimous | majority | unknown }
  - legal_reference: { normType, number or null, year or null, provision or null, citation as written }
- Every other claim uses category "untyped" with value null.`;

export function renderClaimExtractorPrompt(paragraphs: { index: number; text: string }[]): string {
  return `Summary paragraphs:\n${paragraphs.map((p) => `[${p.index}] ${p.text}`).join('\n')}`;
}

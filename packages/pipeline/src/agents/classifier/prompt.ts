import type { DocumentType } from '@app/shared';

export const CLASSIFIER_SYSTEM_PROMPT = `You classify Brazilian legal documents from their beginning (and, for long documents, their end).

Document types:
- court_decision: a judicial decision, such as an "acórdão" of the STJ, a monocratic decision or a judgment ("sentença").
- normative_act: a rule-making act, such as a "resolução", "recomendação", "provimento", "portaria" or a law.
- generic: anything else.

Subtype: set "amendment" only for a normative_act whose main purpose is to change another act (for example "Altera a Resolução CNJ nº 400/2021"). Otherwise null.

Metadata (use null when the text does not state it; never guess):
- issuer: the court or body that issued the document (for example "STJ", "CNJ");
- identifier: the case or act identifier as written (for example "REsp 1.969.219/SP", "Resolução nº 335/2020");
- date: ISO date (YYYY-MM-DD) of the judgment for decisions, or of the signature/publication for acts;
- judgingBody: the panel that judged ("Quarta Turma", "Corte Especial"), decisions only;
- rapporteur: the reporting justice ("Ministro Fulano"), decisions only.

confidence: "high" when the type is unmistakable, "medium" when likely, "low" when unsure.
rationale: one or two short sentences explaining the classification.`;

export function renderClassifierPrompt(input: { head: string; tail: string; forcedType: DocumentType | null }): string {
  const parts = [];
  if (input.forcedType)
    parts.push(
      `The document type is fixed as "${input.forcedType}". Set documentType to "${input.forcedType}" and fill subtype and metadata.`,
    );
  parts.push(`<document_start>\n${input.head}\n</document_start>`);
  if (input.tail) parts.push(`<document_end>\n${input.tail}\n</document_end>`);
  return parts.join('\n\n');
}

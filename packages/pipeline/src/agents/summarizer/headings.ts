import type { DocumentSubtype, DocumentType, Summary } from '@app/shared';

/** Section headings per document type (spec §6.3). */
export const SECTION_HEADINGS: Record<DocumentType, string[]> = {
  court_decision: ['O que foi discutido', 'O que o tribunal decidiu', 'Por quê', 'O que muda na prática'],
  normative_act: ['Do que trata', 'Quem precisa cumprir', 'O que deve ser feito', 'Prazos e vigência'],
  generic: ['Do que trata', 'Pontos principais', 'Prazos e valores'],
};

export const AMENDMENT_HEADING = 'O que mudou';

export function headingsFor(type: DocumentType, subtype: DocumentSubtype | null): string[] {
  const headings = SECTION_HEADINGS[type];
  return type === 'normative_act' && subtype === 'amendment' ? [AMENDMENT_HEADING, ...headings] : headings;
}

export const TARGET_WORDS = { short: 150, medium: 350, long: 700 } as const;

/** Overview and paragraphs, separated by blank lines. */
export function summaryPlainText(summary: Summary): string {
  return [summary.overview, ...summary.sections.flatMap((s) => s.paragraphs.map((p) => p.text))]
    .filter((t) => t.trim())
    .join('\n\n');
}

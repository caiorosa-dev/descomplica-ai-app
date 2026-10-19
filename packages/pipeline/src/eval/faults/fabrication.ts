import type { Fact, InjectedFault, Summary } from '@app/shared';

export const FABRICATED_SENTENCE = 'O prazo para cumprimento é de 90 (noventa) dias.';

/** Appends a deadline the document never states to the last paragraph of the first section. */
export function fabrication(summary: Summary, facts: Fact[]): { summary: Summary; fault: InjectedFault } | null {
  const first = summary.sections[0];
  if (!first || first.paragraphs.length === 0) return null;
  if (facts.some((f) => f.category === 'deadline' && f.value.amount === 90 && f.value.unit === 'days')) return null;
  const last = first.paragraphs.length - 1;
  const paragraphs = first.paragraphs.map((p, j) =>
    j === last ? { ...p, text: `${p.text.trimEnd()} ${FABRICATED_SENTENCE}` } : p,
  );
  return {
    summary: { ...summary, sections: summary.sections.map((s, i) => (i === 0 ? { ...s, paragraphs } : s)) },
    fault: {
      type: 'fabrication',
      description: `Frase inventada acrescentada à seção "${first.heading}": "${FABRICATED_SENTENCE}"`,
      expected: { alertType: 'unsupported_claim', category: 'deadline' },
    },
  };
}

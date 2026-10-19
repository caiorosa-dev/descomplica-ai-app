import type { Fact, FactCategory, InjectedFault, Summary } from '@app/shared';

const ORDER: FactCategory[] = ['decision', 'deadline', 'monetary_value', 'obligation'];

/** Removes the first paragraph citing a decision fact (else deadline, value, obligation), and its section if empty. */
export function omission(summary: Summary, facts: Fact[]): { summary: Summary; fault: InjectedFault } | null {
  const categoryOf = new Map(facts.map((f) => [f.id, f.category]));
  for (const category of ORDER) {
    for (const [si, section] of summary.sections.entries()) {
      const pi = section.paragraphs.findIndex((p) => p.factRefs.some((id) => categoryOf.get(id) === category));
      if (pi === -1) continue;
      const paragraphs = section.paragraphs.filter((_, j) => j !== pi);
      const sections =
        paragraphs.length === 0
          ? summary.sections.filter((_, i) => i !== si)
          : summary.sections.map((s, i) => (i === si ? { ...s, paragraphs } : s));
      return {
        summary: { ...summary, sections },
        fault: {
          type: 'omission',
          description: `Parágrafo removido da seção "${section.heading}": "${section.paragraphs[pi]?.text}"`,
          expected: { alertType: 'omission', category },
        },
      };
    }
  }
  return null;
}

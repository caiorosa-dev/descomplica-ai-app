import type { Section, SectionKind } from '@app/shared';
import type { Paragraph, SectionStart } from './paragraphs';

/**
 * Turns ordered section starts into contiguous, non-overlapping sections: each one runs until the paragraph
 * before the next start. Paragraphs before the first start become a preamble.
 */
export function buildSections(paragraphs: Paragraph[], starts: SectionStart<SectionKind>[]): Section[] {
  const all = [...starts];
  if (paragraphs.length > 0 && (all[0]?.paragraph ?? paragraphs.length) > 0)
    all.unshift({ paragraph: 0, kind: 'preamble', label: 'Preâmbulo', parentLabel: null });
  return all.map((s, i) => {
    const last = (all[i + 1]?.paragraph ?? paragraphs.length) - 1;
    return {
      id: `S${String(i + 1).padStart(2, '0')}`,
      kind: s.kind,
      label: s.label,
      parentLabel: s.parentLabel,
      start: (paragraphs[s.paragraph] as Paragraph).start,
      end: (paragraphs[last] as Paragraph).end,
    };
  });
}

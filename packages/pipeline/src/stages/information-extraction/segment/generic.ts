import type { Section } from '@app/shared';
import { splitParagraphs } from './paragraphs';

export function segmentGeneric(text: string): Section[] {
  return splitParagraphs(text).map((p, i) => ({
    id: `S${String(i + 1).padStart(2, '0')}`,
    kind: 'paragraph',
    label: `Parágrafo ${i + 1}`,
    parentLabel: null,
    start: p.start,
    end: p.end,
  }));
}

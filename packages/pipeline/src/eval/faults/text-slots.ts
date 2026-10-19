import type { Summary } from '@app/shared';

/** A piece of summary text a mutator may rewrite: the overview, then each paragraph in reading order. */
interface TextSlot {
  text: string;
  set: (summary: Summary, text: string) => Summary;
}

export function textSlots(summary: Summary): TextSlot[] {
  const slots: TextSlot[] = [{ text: summary.overview, set: (s, text) => ({ ...s, overview: text }) }];
  summary.sections.forEach((section, si) => {
    section.paragraphs.forEach((paragraph, pi) => {
      slots.push({
        text: paragraph.text,
        set: (s, text) => ({
          ...s,
          sections: s.sections.map((sec, i) =>
            i !== si ? sec : { ...sec, paragraphs: sec.paragraphs.map((p, j) => (j !== pi ? p : { ...p, text })) },
          ),
        }),
      });
    });
  });
  return slots;
}

export interface Rewrite {
  summary: Summary;
  before: string;
  after: string;
}

/**
 * Rewrites the first match, in reading order, for which `rewrite` returns a replacement.
 * Returns null when nothing in the summary qualifies.
 */
export function rewriteFirst<M extends { start: number; end: number }>(
  summary: Summary,
  find: (text: string) => M[],
  rewrite: (match: M, raw: string) => string | null,
): Rewrite | null {
  for (const slot of textSlots(summary)) {
    for (const match of find(slot.text)) {
      const before = slot.text.slice(match.start, match.end);
      const after = rewrite(match, before);
      if (after === null || after === before) continue;
      const text = slot.text.slice(0, match.start) + after + slot.text.slice(match.end);
      return { summary: slot.set(summary, text), before, after };
    }
  }
  return null;
}

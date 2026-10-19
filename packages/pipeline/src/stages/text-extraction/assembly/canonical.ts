import type { PageRange } from '@app/shared';
import type { Line } from '../types';

export interface CanonicalText {
  canonicalText: string;
  pageMap: PageRange[];
  lineSpans: { lineId: number; start: number; end: number }[];
}

/** Joins lines with ' ' inside a paragraph and '\n\n' between paragraphs, keeping each line's [start, end). */
export function buildCanonicalText(lines: Line[], breaks: boolean[]): CanonicalText {
  let text = '';
  const lineSpans: CanonicalText['lineSpans'] = [];
  const pages = new Map<number, { start: number; end: number }>();
  lines.forEach((line, i) => {
    if (text.length > 0) text += breaks[i] ? '\n\n' : ' ';
    const start = text.length;
    text += line.text;
    const end = text.length;
    lineSpans.push({ lineId: line.id, start, end });
    const range = pages.get(line.page);
    if (range) {
      range.start = Math.min(range.start, start);
      range.end = Math.max(range.end, end);
    } else pages.set(line.page, { start, end });
  });
  const pageMap = [...pages.entries()].sort(([a], [b]) => a - b).map(([page, r]) => ({ page, ...r }));
  return { canonicalText: text, pageMap, lineSpans };
}

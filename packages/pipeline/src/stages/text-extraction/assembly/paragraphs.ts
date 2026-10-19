import type { LineDocument } from '../types';
import { allLines } from '../types';

/** Lines that open a structural unit (spec §6.1, rule 6). */
export const STRUCTURAL_MARKER =
  /^(Art\.|Arts\.|§|[IVXLCDM]+\s*[-–—]|[a-z]\)|EMENTA|ACÓRDÃO|RELATÓRIO|VOTO|CONSIDERANDO|CAPÍTULO|ANEXO)/u;

const TERMINAL_PUNCTUATION = /[.:;?!]$/;
/** Abbreviations that end a line without ending the sentence ("no disposto no art." / "18, que ..."). */
const TRAILING_ABBREVIATION = /\b(art|arts|inc|incs|n|nº|fls|p|pp|min|rel|des|dr|dra|sr|sra|ltda|cf)\.$/i;
const GAP_FACTOR = 1.5;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * `true` at index i when a paragraph starts before line i (document order). HTML and DOCX lines already come
 * from block elements, so each one is a paragraph; PDF and TXT lines are rebuilt into paragraphs.
 */
export function paragraphBreaks(doc: LineDocument): boolean[] {
  const lines = allLines(doc);
  if (doc.format === 'html' || doc.format === 'docx') return lines.map(() => true);
  const medianGap = new Map<number, number | null>();
  for (const page of doc.pages) {
    const gaps: number[] = [];
    for (let i = 1; i < page.lines.length; i++) {
      const gap = (page.lines[i]?.y ?? 0) - (page.lines[i - 1]?.y ?? 0);
      if (gap > 0) gaps.push(gap);
    }
    medianGap.set(page.number, median(gaps));
  }
  return lines.map((line, i) => {
    const previous = lines[i - 1];
    if (!previous) return true;
    if (STRUCTURAL_MARKER.test(line.text)) return true;
    if (TERMINAL_PUNCTUATION.test(previous.text) && !TRAILING_ABBREVIATION.test(previous.text)) return true;
    const gap = medianGap.get(line.page);
    return previous.page === line.page && gap != null && line.y - previous.y > GAP_FACTOR * gap;
  });
}

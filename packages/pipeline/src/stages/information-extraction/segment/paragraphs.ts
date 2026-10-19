export interface Paragraph {
  index: number;
  text: string;
  start: number;
  end: number;
}

/** Paragraphs of the canonical text (separated by blank lines), with their [start, end) positions. */
export function splitParagraphs(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  const re = /[^\n]+(?:\n(?!\n)[^\n]*)*/g;
  for (const m of text.matchAll(re)) {
    const trimmed = m[0].trim();
    if (!trimmed) continue;
    const start = m.index + (m[0].length - m[0].trimStart().length);
    out.push({ index: out.length, text: trimmed, start, end: start + trimmed.length });
  }
  return out;
}

export interface SectionStart<K extends string = string> {
  paragraph: number;
  kind: K;
  label: string;
  parentLabel: string | null;
}

import type { Section } from '@app/shared';
import { countTokens, splitByTokens, tokenWindowStartBefore } from '../../../core/tokens';

export interface TextChunk {
  start: number;
  end: number;
  text: string;
}

interface Unit {
  start: number;
  end: number;
  tokens: number;
}

function paragraphUnits(text: string, start: number, end: number, chunkTokens: number): Unit[] {
  const units: Unit[] = [];
  for (const m of text.slice(start, end).matchAll(/[^\n]+(?:\n(?!\n)[^\n]*)*/g)) {
    const pStart = start + m.index;
    const pEnd = pStart + m[0].length;
    const tokens = countTokens(m[0]);
    if (tokens <= chunkTokens) units.push({ start: pStart, end: pEnd, tokens });
    else
      for (const w of splitByTokens(m[0], chunkTokens, 0))
        units.push({ start: pStart + w.start, end: pStart + w.end, tokens: countTokens(m[0].slice(w.start, w.end)) });
  }
  return units;
}

/**
 * Chunks aligned to sections: consecutive sections are packed up to `chunkTokens`; a larger section is split by
 * paragraph, and a larger paragraph by tokens. Chunks cover the whole text, and each chunk after the first starts
 * `overlapTokens` tokens before the end of the previous one.
 */
export function chunkBySections(
  text: string,
  sections: Section[],
  chunkTokens: number,
  overlapTokens: number,
): TextChunk[] {
  if (text.length === 0) return [];
  const ranges =
    sections.length > 0 ? [...sections].sort((a, b) => a.start - b.start) : [{ start: 0, end: text.length }];
  const units: Unit[] = [];
  for (const r of ranges) {
    const tokens = countTokens(text.slice(r.start, r.end));
    if (tokens <= chunkTokens) units.push({ start: r.start, end: r.end, tokens });
    else units.push(...paragraphUnits(text, r.start, r.end, chunkTokens));
  }

  const base: { start: number; end: number }[] = [];
  let current: Unit | null = null;
  for (const unit of units) {
    if (current && current.tokens + unit.tokens <= chunkTokens) {
      current.end = unit.end;
      current.tokens += unit.tokens;
    } else {
      if (current) base.push(current);
      current = { ...unit };
    }
  }
  if (current) base.push(current);
  if (base.length === 0) return [{ start: 0, end: text.length, text }];

  // Make the base ranges contiguous over [0, text.length): separators belong to the following chunk.
  (base[0] as { start: number }).start = 0;
  for (let i = 1; i < base.length; i++) (base[i] as { start: number }).start = (base[i - 1] as { end: number }).end;
  (base.at(-1) as { end: number }).end = text.length;

  return base.map((b, i) => {
    const previous = base[i - 1];
    const start =
      previous && overlapTokens > 0
        ? tokenWindowStartBefore(text, previous.end, overlapTokens, previous.start)
        : b.start;
    return { start, end: b.end, text: text.slice(start, b.end) };
  });
}

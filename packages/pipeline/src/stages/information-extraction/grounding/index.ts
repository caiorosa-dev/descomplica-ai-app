import type { PageRange, Section } from '@app/shared';
import { normalizeWithMap } from './normalize';

export interface GroundingIndex {
  text: string;
  normalized: string;
  map: number[];
  /** Word trigram → start positions (in the normalized text) of its first word. */
  trigrams: Map<string, number[]>;
  pageMap: PageRange[];
  sections: Section[];
}

export interface Word {
  word: string;
  start: number;
}

export function wordsOf(normalized: string): Word[] {
  return [...normalized.matchAll(/\S+/g)].map((m) => ({ word: m[0], start: m.index }));
}

export function trigramKey(words: Word[], i: number): string {
  return `${words[i]?.word} ${words[i + 1]?.word} ${words[i + 2]?.word}`;
}

/** Built once per document; every quote is grounded against it. */
export function buildGroundingIndex(canonicalText: string, pageMap: PageRange[], sections: Section[]): GroundingIndex {
  const { normalized, map } = normalizeWithMap(canonicalText);
  const words = wordsOf(normalized);
  const trigrams = new Map<string, number[]>();
  for (let i = 0; i + 2 < words.length; i++) {
    const key = trigramKey(words, i);
    const positions = trigrams.get(key);
    if (positions) positions.push((words[i] as Word).start);
    else trigrams.set(key, [(words[i] as Word).start]);
  }
  return { text: canonicalText, normalized, map, trigrams, pageMap, sections };
}

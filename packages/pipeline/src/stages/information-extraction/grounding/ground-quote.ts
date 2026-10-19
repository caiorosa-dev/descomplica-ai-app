import type { MatchType } from '@app/shared';
import { distance } from 'fastest-levenshtein';
import { type GroundingIndex, trigramKey, wordsOf } from './index';
import { normalizeQuote } from './normalize';

export interface GroundingMatch {
  start: number | null;
  end: number | null;
  page: number | null;
  sectionId: string | null;
  matchType: MatchType;
  matchScore: number | null;
}

const NOT_FOUND: GroundingMatch = {
  start: null,
  end: null,
  page: null,
  sectionId: null,
  matchType: 'not_found',
  matchScore: null,
};
const ELLIPSIS = /\s*(\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3}|…)\s*/;
const MIN_FUZZY_WORDS = 3;

interface Span {
  start: number;
  end: number;
  score: number;
}

function fuzzyFind(segment: string, index: GroundingIndex, from: number, threshold: number): Span | null {
  const words = wordsOf(segment);
  if (words.length < MIN_FUZZY_WORDS) return null;
  const starts = new Set<number>();
  for (let i = 0; i + 2 < words.length; i++) {
    const offset = (words[i] as { start: number }).start;
    for (const p of index.trigrams.get(trigramKey(words, i)) ?? []) if (p - offset >= from) starts.add(p - offset);
  }
  const n = segment.length;
  const lengths = [...new Set([n, n - 1, n + 1, Math.round(0.9 * n), Math.round(1.1 * n)])].filter((l) => l > 0);
  let best: Span | null = null;
  for (const start of [...starts].sort((a, b) => a - b))
    for (const len of lengths) {
      const window = index.normalized.slice(start, start + len);
      const score = 1 - distance(window, segment) / Math.max(window.length, n);
      if (score >= threshold && (!best || score > best.score)) best = { start, end: start + window.length, score };
    }
  return best;
}

/**
 * Finds a quote in the canonical text: exact after normalization, otherwise fuzzy (normalized Levenshtein over
 * trigram-anchored windows). Quotes abbreviated with "..." / "[...]" are split and their segments found in order.
 */
export function groundQuote(quote: string, index: GroundingIndex, fuzzyThreshold: number): GroundingMatch {
  const segments = quote
    .split(ELLIPSIS)
    .filter((_, i) => i % 2 === 0)
    .map(normalizeQuote)
    .filter((s) => s.length > 0);
  if (segments.length === 0) return NOT_FOUND;
  const spans: Span[] = [];
  let from = 0;
  for (const segment of segments) {
    const pos = index.normalized.indexOf(segment, from);
    const span =
      pos >= 0 ? { start: pos, end: pos + segment.length, score: 1 } : fuzzyFind(segment, index, from, fuzzyThreshold);
    if (!span) return NOT_FOUND;
    spans.push(span);
    from = span.end;
  }
  const start = index.map[(spans[0] as Span).start] as number;
  const end = index.map[(spans.at(-1) as Span).end] as number;
  const page = index.pageMap.find((p) => start >= p.start && start < Math.max(p.end, p.start + 1))?.page ?? null;
  const sectionId = index.sections.find((s) => start >= s.start && start < s.end)?.id ?? null;
  const allExact = spans.every((s) => s.score === 1);
  return {
    start,
    end,
    page,
    sectionId,
    matchType: allExact ? 'exact' : 'fuzzy',
    matchScore: Math.min(...spans.map((s) => s.score)),
  };
}

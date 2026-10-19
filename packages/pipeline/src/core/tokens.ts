import { decode, encode } from 'gpt-tokenizer';

export function countTokens(text: string): number {
  return text ? encode(text).length : 0;
}

/** The first `n` tokens of the text (decoded back to a string). */
export function headTokens(text: string, n: number): string {
  if (n <= 0) return '';
  const tokens = encode(text);
  return tokens.length <= n ? text : decode(tokens.slice(0, n));
}

/** The last `n` tokens of the text (decoded back to a string). */
export function tailTokens(text: string, n: number): string {
  if (n <= 0) return '';
  const tokens = encode(text);
  return tokens.length <= n ? text : decode(tokens.slice(-n));
}

/** Largest end in (start, text.length] whose slice has at most `maxTokens` tokens, pulled back to a word boundary. */
export function tokenWindowEnd(text: string, start: number, maxTokens: number): number {
  if (countTokens(text.slice(start)) <= maxTokens) return text.length;
  let lo = start + 1;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (countTokens(text.slice(start, mid)) <= maxTokens) lo = mid;
    else hi = mid - 1;
  }
  const space = text.lastIndexOf(' ', lo);
  return space > start ? space : lo;
}

/** Smallest start in [floor, end) whose slice up to `end` has at most `nTokens` tokens, pushed to a word boundary. */
export function tokenWindowStartBefore(text: string, end: number, nTokens: number, floor = 0): number {
  if (nTokens <= 0) return end;
  let lo = floor;
  let hi = end;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (countTokens(text.slice(mid, end)) <= nTokens) hi = mid;
    else lo = mid + 1;
  }
  if (lo === floor) return lo;
  const space = text.indexOf(' ', lo);
  return space >= 0 && space + 1 < end ? space + 1 : lo;
}

/** Windows of at most `maxTokens` tokens covering the text in order; each one starts `overlapTokens` before the previous end. */
export function splitByTokens(
  text: string,
  maxTokens: number,
  overlapTokens: number,
): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  let start = 0;
  while (start < text.length) {
    const end = tokenWindowEnd(text, start, maxTokens);
    windows.push({ start, end });
    if (end >= text.length) break;
    const next = overlapTokens > 0 ? tokenWindowStartBefore(text, end, overlapTokens, start + 1) : end;
    start = next > start ? next : end;
  }
  return windows;
}

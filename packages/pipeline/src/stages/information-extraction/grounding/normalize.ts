const DOUBLE_QUOTES = /[“”„‟«»]/;
const SINGLE_QUOTES = /[‘’‚‛]/;
const DASHES = /[–—]/;
const WHITESPACE = /\s/;

/**
 * Lowercases, straightens curly quotes, turns en/em dashes into '-', and collapses whitespace runs into one space.
 * `map[i]` is the original position of normalized character i; `map[normalized.length] === text.length`.
 */
export function normalizeWithMap(text: string): { normalized: string; map: number[] } {
  let normalized = '';
  const map: number[] = [];
  let inSpace = false;
  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i) as number;
    const char = String.fromCodePoint(codePoint);
    if (WHITESPACE.test(char)) {
      if (!inSpace) {
        normalized += ' ';
        map.push(i);
      }
      inSpace = true;
    } else {
      inSpace = false;
      let out = char.toLowerCase();
      if (DOUBLE_QUOTES.test(char)) out = '"';
      else if (SINGLE_QUOTES.test(char)) out = "'";
      else if (DASHES.test(char)) out = '-';
      for (let k = 0; k < out.length; k++) map.push(i);
      normalized += out;
    }
    i += char.length;
  }
  map.push(text.length);
  return { normalized, map };
}

export function normalizeQuote(text: string): string {
  return normalizeWithMap(text).normalized.trim();
}

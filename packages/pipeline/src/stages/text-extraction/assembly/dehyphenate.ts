import type { Line } from '../types';

/** Oblique pronouns joined by a hyphen ("dar-lhe", "aplica-se"): the hyphen stays (spec §6.1, rule 5). */
export const CLITICS = [
  'lhe',
  'lhes',
  'se',
  'o',
  'a',
  'os',
  'as',
  'me',
  'te',
  'nos',
  'vos',
  'lo',
  'la',
  'los',
  'las',
  'no',
  'na',
];

const ENDS_WITH_HYPHENATED_WORD = /\p{L}-$/u;
const STARTS_LOWERCASE = /^\p{Ll}/u;

/** Joins a word split by an end-of-line hyphen with the first word of the next line (also across pages). */
export function dehyphenate(lines: Line[]): Line[] {
  const out = lines.map((line) => ({ ...line }));
  for (let i = 0; i < out.length - 1; i++) {
    const current = out[i] as Line;
    const next = out[i + 1] as Line;
    if (!ENDS_WITH_HYPHENATED_WORD.test(current.text) || !STARTS_LOWERCASE.test(next.text)) continue;
    const [, firstToken = '', rest = ''] = /^(\S+)\s*(.*)$/u.exec(next.text) ?? [];
    const word = firstToken.replace(/[^\p{L}]+$/u, '').toLowerCase();
    current.text = CLITICS.includes(word) ? current.text + firstToken : current.text.slice(0, -1) + firstToken;
    next.text = rest;
  }
  return out.filter((line) => line.text !== '');
}

import type { LineDocument } from '../types';

const LIGATURES: Record<string, string> = { ﬀ: 'ff', ﬁ: 'fi', ﬂ: 'fl', ﬃ: 'ffi', ﬄ: 'ffl', ﬅ: 'st', ﬆ: 'st' };
const LIGATURE_RE = new RegExp(`[${Object.keys(LIGATURES).join('')}]`, 'g');
const SPECIAL_SPACES = /[    - 　]/g;
// C0/C1 control characters, soft hyphen and zero-width characters.
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point of this rule.
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f­​-‍⁠﻿]/g;

export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(LIGATURE_RE, (c) => LIGATURES[c] ?? c)
    .replace(SPECIAL_SPACES, ' ')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** NFC, ligatures, non-breaking spaces and control characters; lines left empty are dropped. */
export function normalizeUnicode(doc: LineDocument): LineDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      lines: page.lines.map((line) => ({ ...line, text: normalizeText(line.text) })).filter((line) => line.text !== ''),
    })),
  };
}

import type { LineDocument } from '../types';

/** One line per `\n` on a single page; `y` keeps the original line index so blank lines remain visible as gaps. */
export function extractTxt(buffer: Uint8Array): LineDocument {
  const raw = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
  const rows = raw.split(/\r?\n/);
  const lines = rows
    .map((text, index) => ({ text: text.trim(), index }))
    .filter((r) => r.text !== '')
    .map((r, i) => ({ id: i, text: r.text, y: r.index, height: 1, page: 1 }));
  return { format: 'txt', pages: [{ number: 1, height: rows.length, lines }] };
}

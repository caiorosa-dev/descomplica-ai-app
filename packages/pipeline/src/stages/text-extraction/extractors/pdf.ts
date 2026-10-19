import { getDocumentProxy } from 'unpdf';
import type { Line, LineDocument, Page } from '../types';

export interface PositionedItem {
  str: string;
  x: number;
  /** Measured from the top of the page. */
  y: number;
  width: number;
  height: number;
}

/** Items closer than this (in points) or than half the font height belong to the same row (superscripts included). */
const MIN_ROW_TOLERANCE = 2;
/** A horizontal gap wider than this fraction of the font height is a word break. */
const SPACE_GAP_RATIO = 0.15;

const isSpace = (item: PositionedItem) => item.str.trim() === '';

/** Groups positioned text items into lines (top to bottom, left to right) and joins them with spaces where needed. */
export function buildLines(items: PositionedItem[], page: number, firstId: number): Line[] {
  const visible = items.filter((i) => i.str !== '');
  const sorted = [...visible].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { items: PositionedItem[]; y: number; height: number }[] = [];
  for (const item of sorted) {
    const row = rows.at(-1);
    const tolerance = Math.max(MIN_ROW_TOLERANCE, 0.5 * Math.max(item.height, row?.height ?? 0));
    if (row && Math.abs(row.y - item.y) <= tolerance) {
      row.items.push(item);
      // The row's position follows its tallest text, so superscripts do not shift it.
      if (item.height > row.height) {
        row.height = item.height;
        row.y = item.y;
      }
    } else rows.push({ items: [item], y: item.y, height: item.height });
  }
  let nextId = firstId;
  const lines: Line[] = [];
  for (const row of rows) {
    const ordered = [...row.items].sort((a, b) => a.x - b.x);
    let text = '';
    let previous: PositionedItem | undefined;
    for (const item of ordered) {
      if (isSpace(item)) {
        text += ' ';
        previous = item;
        continue;
      }
      const fontHeight = Math.max(item.height, previous?.height ?? 0);
      const gap = previous ? item.x - (previous.x + previous.width) : 0;
      if (previous && !isSpace(previous) && gap > SPACE_GAP_RATIO * fontHeight) text += ' ';
      text += item.str;
      previous = item;
    }
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean) lines.push({ id: nextId++, text: clean, y: row.y, height: row.height, page });
  }
  return lines;
}

/** Rebuilds lines from pdf.js text items by vertical position, keeping page, y and font height. */
export async function extractPdf(buffer: Uint8Array): Promise<LineDocument> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages: Page[] = [];
  let nextId = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const height = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent();
    const items: PositionedItem[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      items.push({
        str: item.str,
        x: item.transform[4] ?? 0,
        y: height - (item.transform[5] ?? 0),
        width: item.width,
        height: item.height || (item.str.trim() === '' ? 0 : Math.abs(item.transform[3] ?? 0)),
      });
    }
    const lines = buildLines(items, number, nextId);
    nextId += lines.length;
    pages.push({ number, height, lines });
  }
  return { format: 'pdf', pages };
}

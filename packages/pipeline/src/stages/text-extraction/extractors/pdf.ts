import { getDocumentProxy } from 'unpdf';
import type { LineDocument, Page } from '../types';

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const SAME_LINE_TOLERANCE = 2;

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
      if (!('str' in item) || item.str.trim() === '') continue;
      const fontHeight = item.height || Math.abs(item.transform[3] ?? 0);
      items.push({
        str: item.str,
        x: item.transform[4] ?? 0,
        y: height - (item.transform[5] ?? 0),
        width: item.width,
        height: fontHeight,
      });
    }
    items.sort((a, b) => a.y - b.y || a.x - b.x);

    const rows: PositionedItem[][] = [];
    for (const item of items) {
      const row = rows.at(-1);
      if (row && Math.abs((row[0] as PositionedItem).y - item.y) <= SAME_LINE_TOLERANCE) row.push(item);
      else rows.push([item]);
    }
    const lines = rows.map((row) => {
      row.sort((a, b) => a.x - b.x);
      let text = '';
      let previous: PositionedItem | undefined;
      for (const item of row) {
        const gap = previous ? item.x - (previous.x + previous.width) : 0;
        if (previous && gap > 0.5 * Math.max(item.height, previous.height) && !text.endsWith(' ')) text += ' ';
        text += item.str;
        previous = item;
      }
      return {
        id: nextId++,
        text: text.trim(),
        y: Math.min(...row.map((i) => i.y)),
        height: Math.max(...row.map((i) => i.height)),
        page: number,
      };
    });
    pages.push({ number, height, lines: lines.filter((l) => l.text !== '') });
  }
  return { format: 'pdf', pages };
}

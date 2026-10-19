import { Document, Packer, Paragraph } from 'docx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const A4 = { width: 595.28, height: 841.89 };
const FONT_SIZE = 11;

export interface LayoutItem {
  text: string;
  /** Measured from the top of the page. */
  y: number;
  /** Font size (default 11). */
  size?: number;
  /** Place the item this many points after the end of the previous item (same row) instead of at x = 50. */
  gapBefore?: number;
}

/** Builds an A4 PDF placing each item at an explicit `y` measured from the top of the page. */
export async function makePdfLayout(pages: LayoutItem[][]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const items of pages) {
    const page = pdf.addPage([A4.width, A4.height]);
    let x = 50;
    for (const item of items) {
      const size = item.size ?? FONT_SIZE;
      const start = item.gapBefore === undefined ? 50 : x + item.gapBefore;
      page.drawText(item.text, { x: start, y: A4.height - item.y, size, font });
      x = start + font.widthOfTextAtSize(item.text, size);
    }
  }
  return pdf.save();
}

/** A4 PDF with Helvetica 11pt; the first line of each page at y=50 (from the top), 14pt apart. */
export function makePdf(pages: string[][]): Promise<Uint8Array> {
  return makePdfLayout(pages.map((lines) => lines.map((text, i) => ({ text, y: 50 + i * 14 }))));
}

export async function makeDocx(paragraphs: string[]): Promise<Uint8Array> {
  const doc = new Document({ sections: [{ children: paragraphs.map((text) => new Paragraph({ text })) }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

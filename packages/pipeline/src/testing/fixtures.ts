import { Document, Packer, Paragraph } from 'docx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const A4 = { width: 595.28, height: 841.89 };
const FONT_SIZE = 11;

/** Builds an A4 PDF placing each line at an explicit `y` measured from the top of the page. */
export async function makePdfLayout(pages: { text: string; y: number }[][]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = pdf.addPage([A4.width, A4.height]);
    for (const line of lines) page.drawText(line.text, { x: 50, y: A4.height - line.y, size: FONT_SIZE, font });
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

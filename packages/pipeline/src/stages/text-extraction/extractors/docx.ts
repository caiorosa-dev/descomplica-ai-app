import mammoth from 'mammoth';
import type { LineDocument } from '../types';
import { extractHtmlString } from './html';

/** DOCX → HTML with mammoth (Word headers and footers are left out), then the HTML extractor. */
export async function extractDocx(buffer: Uint8Array, options: { dropStrikethrough: boolean }): Promise<LineDocument> {
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });
  return extractHtmlString(value, options, 'docx');
}

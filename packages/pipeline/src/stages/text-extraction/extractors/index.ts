import type { SourceFormat } from '@app/shared';
import type { LineDocument } from '../types';
import { extractDocx } from './docx';
import { extractHtml } from './html';
import { extractPdf } from './pdf';
import { extractTxt } from './txt';

export async function extractLines(
  buffer: Uint8Array,
  format: SourceFormat,
  options: { dropStrikethrough: boolean },
): Promise<LineDocument> {
  switch (format) {
    case 'pdf':
      return extractPdf(buffer);
    case 'html':
      return extractHtml(buffer, options);
    case 'docx':
      return extractDocx(buffer, options);
    case 'txt':
      return extractTxt(buffer);
  }
}

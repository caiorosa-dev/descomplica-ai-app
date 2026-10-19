import type { SourceFormat } from '@app/shared';
import { fileTypeFromBuffer } from 'file-type';
import { PipelineError } from '../../core/errors';

const HTML_SNIFF = /<(!doctype html|html|body|div|p)\b/i;

/** Detects the format from the content (magic bytes), never from the extension. */
export async function detectFormat(buffer: Uint8Array, filename: string): Promise<SourceFormat> {
  const type = await fileTypeFromBuffer(buffer);
  if (type?.ext === 'pdf') return 'pdf';
  if (type?.ext === 'docx') return 'docx';
  if (type) throw new PipelineError('UNSUPPORTED_FILE', `Unsupported file type ${type.mime} (${filename})`);
  let head: string;
  try {
    head = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, 2048 + 4)).slice(0, 2048);
  } catch {
    try {
      // The 2 KB cut may split a multi-byte character; validate the whole buffer before giving up.
      head = new TextDecoder('utf-8', { fatal: true }).decode(buffer).slice(0, 2048);
    } catch {
      throw new PipelineError('UNSUPPORTED_FILE', `File is neither a known binary format nor UTF-8 text (${filename})`);
    }
  }
  return HTML_SNIFF.test(head) ? 'html' : 'txt';
}

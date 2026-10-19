import { createHash } from 'node:crypto';
import { detectFormat } from '@app/pipeline';
import { MIME_BY_FORMAT, type UploadDocumentResponse } from '@app/shared';
import type { FileStorage } from '../../storage/file-storage';
import type { createDocumentsRepository } from './repository';

/** Stores an upload once per sha256; the same bytes uploaded again return the existing document. */
export async function uploadDocument(
  deps: { repo: ReturnType<typeof createDocumentsRepository>; storage: FileStorage },
  file: { filename: string; buffer: Buffer },
): Promise<UploadDocumentResponse> {
  const sha256 = createHash('sha256').update(file.buffer).digest('hex');
  const existing = await deps.repo.findBySha(sha256);
  if (existing) return { document: existing, deduplicated: true };
  const format = await detectFormat(file.buffer, file.filename);
  const storagePath = await deps.storage.save(file.buffer, sha256, format);
  const document = await deps.repo.create({
    filename: file.filename,
    mimeType: MIME_BY_FORMAT[format],
    sizeBytes: file.buffer.byteLength,
    sha256,
    storagePath,
  });
  return { document, deduplicated: false };
}

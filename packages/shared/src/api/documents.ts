import { z } from 'zod';
import { DocumentSource, DocumentType, RunStatus, type SourceFormat } from '../domain/enums';

export const MIME_BY_FORMAT: Record<SourceFormat, string> = {
  pdf: 'application/pdf',
  html: 'text/html',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

export const DocumentDto = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  sha256: z.string(),
  source: DocumentSource,
  corpusKey: z.string().nullable(),
  createdAt: z.string(),
  /** From the most recent completed run. */
  detectedType: DocumentType.nullable(),
  pages: z.number().int().nullable(),
  runCount: z.number().int(),
  lastRunStatus: RunStatus.nullable(),
  lastRunId: z.string().nullable(),
});
export type DocumentDto = z.infer<typeof DocumentDto>;

export const UploadDocumentResponse = z.object({ document: DocumentDto, deduplicated: z.boolean() });
export type UploadDocumentResponse = z.infer<typeof UploadDocumentResponse>;

import { DocumentDto, UploadDocumentResponse } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { HttpError, notFound } from '../../http-error';
import { createDocumentsRepository } from './repository';
import { uploadDocument } from './service';

const rfc5987 = (value: string) =>
  encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** `attachment` with an ASCII fallback and the UTF-8 name (RFC 6266 / RFC 5987). */
export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${rfc5987(filename)}`;
}

export const IdParams = z.object({ id: z.string().uuid() });

export async function documentsRoutes(app: FastifyInstance): Promise<void> {
  const repo = createDocumentsRepository(app.prisma);
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/documents',
    { schema: { response: { 200: UploadDocumentResponse, 201: UploadDocumentResponse } } },
    async (request, reply) => {
      const file = request.isMultipart() ? await request.file() : undefined;
      if (!file)
        throw new HttpError(400, 'VALIDATION_ERROR', 'Envie um arquivo no campo "file" (multipart/form-data).');
      const buffer = await file.toBuffer();
      const result = await uploadDocument({ repo, storage: app.storage }, { filename: file.filename, buffer });
      return reply.status(result.deduplicated ? 200 : 201).send(result);
    },
  );

  r.get('/documents', { schema: { response: { 200: z.array(DocumentDto) } } }, async () => repo.list());

  r.get('/documents/:id', { schema: { params: IdParams, response: { 200: DocumentDto } } }, async (request) => {
    const document = await repo.get(request.params.id);
    if (!document) throw notFound('Documento');
    return document;
  });

  r.get('/documents/:id/file', { schema: { params: IdParams } }, async (request, reply) => {
    const row = await repo.getRow(request.params.id);
    if (!row) throw notFound('Documento');
    const buffer = await app.storage.read(row.storagePath);
    return reply
      .header('content-type', row.mimeType)
      .header('content-disposition', contentDisposition(row.filename))
      .send(buffer);
  });
}

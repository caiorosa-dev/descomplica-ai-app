import { DocumentDto, UploadDocumentResponse } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { contentDisposition } from '../src/modules/documents/routes';
import { createTestApp } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';
import { upload } from './helpers/multipart';

const prisma = testPrisma();
const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
]);
let app: FastifyInstance;

beforeEach(async () => {
  await resetDatabase(prisma);
  app = await createTestApp();
});
afterEach(() => app.close());

test('upload then dedupe (Review Focus 5)', async () => {
  const first = await upload(app, 'a.txt', 'Art. 1º Fica instituído.');
  expect(first.statusCode).toBe(201);
  expect(first.json().deduplicated).toBe(false);
  const again = await upload(app, 'b.txt', 'Art. 1º Fica instituído.');
  expect(again.statusCode).toBe(200);
  expect(again.json()).toMatchObject({ deduplicated: true, document: { id: first.json().document.id } });
  expect(await prisma.document.count()).toBe(1);
  const doc = UploadDocumentResponse.parse(first.json()).document;
  expect(doc).toMatchObject({
    filename: 'a.txt',
    mimeType: 'text/plain',
    source: 'upload',
    sizeBytes: 26,
    runCount: 0,
    lastRunStatus: null,
  });
});

test('rejects png with 415', async () => {
  const res = await upload(app, 'x.png', PNG_HEADER);
  expect(res.statusCode).toBe(415);
  expect(res.json()).toMatchObject({ error: { code: 'UNSUPPORTED_FILE' } });
  expect(await prisma.document.count()).toBe(0);
});

test('request without a file is a validation error', async () => {
  const res = await app.inject({ method: 'POST', url: '/documents', payload: {} });
  expect(res.statusCode).toBeGreaterThanOrEqual(400);
  expect(res.statusCode).toBeLessThan(500);
});

test('list includes runCount 0', async () => {
  await upload(app, 'a.txt', 'Primeiro.');
  await upload(app, 'b.html', '<html><body><p>Segundo.</p></body></html>');
  const res = await app.inject({ method: 'GET', url: '/documents' });
  const list = DocumentDto.array().parse(res.json());
  expect(list).toHaveLength(2);
  expect(list.every((d) => d.runCount === 0 && d.detectedType === null && d.pages === null)).toBe(true);
  expect(list.map((d) => d.mimeType).sort()).toEqual(['text/html', 'text/plain']);
});

test('get by id and 404', async () => {
  const { document } = (await upload(app, 'a.txt', 'abc')).json();
  expect((await app.inject({ method: 'GET', url: `/documents/${document.id}` })).json()).toMatchObject({
    id: document.id,
  });
  const missing = await app.inject({ method: 'GET', url: `/documents/${crypto.randomUUID()}` });
  expect(missing.statusCode).toBe(404);
  expect(missing.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
});

test('file download returns same bytes and RFC 5987 filename', async () => {
  const { document } = (await upload(app, 'decisão.txt', 'abc')).json();
  const res = await app.inject({ method: 'GET', url: `/documents/${document.id}/file` });
  expect(res.body).toBe('abc');
  expect(res.headers['content-type']).toContain('text/plain');
  expect(res.headers['content-disposition']).toContain("filename*=UTF-8''decis%C3%A3o.txt");
});

test('contentDisposition escapes quotes and non-ASCII in the fallback', () =>
  expect(contentDisposition('a "b" ç.pdf')).toBe(
    `attachment; filename="a _b_ _.pdf"; filename*=UTF-8''a%20%22b%22%20%C3%A7.pdf`,
  ));

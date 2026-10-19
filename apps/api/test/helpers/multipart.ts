import type { FastifyInstance } from 'fastify';

/** Builds a multipart/form-data body with one `file` field and injects POST /documents. */
export function upload(app: FastifyInstance, filename: string, content: string | Uint8Array) {
  const boundary = `----test${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, typeof content === 'string' ? Buffer.from(content) : Buffer.from(content), tail]);
  return app.inject({
    method: 'POST',
    url: '/documents',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: body,
  });
}

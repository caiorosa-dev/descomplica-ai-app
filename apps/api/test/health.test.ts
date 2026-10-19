import { PipelineError } from '@app/pipeline';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { HttpError } from '../src/http-error';
import { createTestApp } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  app.get('/test/http-error', async () => {
    throw new HttpError(409, 'X', 'm', { a: 1 });
  });
  app.get('/test/pipeline-error', async () => {
    throw new PipelineError('UNSUPPORTED_FILE', 'unsupported in test');
  });
  app.get('/test/unknown-error', async () => {
    throw new Error('secret internals');
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/test/validated', { schema: { body: z.object({ n: z.number() }) } }, async (req) => ({
      n: req.body.n,
    }));
});

afterAll(async () => {
  await app.close();
});

test('health ok', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: 'ok', database: 'ok' });
});

test('unknown route uses error format', async () => {
  const res = await app.inject({ method: 'GET', url: '/nope' });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
});

test('HttpError and PipelineError are mapped', async () => {
  const http = await app.inject({ method: 'GET', url: '/test/http-error' });
  expect(http.statusCode).toBe(409);
  expect(http.json()).toEqual({ error: { code: 'X', message: 'm', details: { a: 1 } } });
  const pipeline = await app.inject({ method: 'GET', url: '/test/pipeline-error' });
  expect(pipeline.statusCode).toBe(415);
  expect(pipeline.json()).toMatchObject({
    error: { code: 'UNSUPPORTED_FILE', message: new PipelineError('UNSUPPORTED_FILE', 'x').userMessage },
  });
});

test('unexpected errors become 500 INTERNAL_ERROR without leaking the message', async () => {
  const res = await app.inject({ method: 'GET', url: '/test/unknown-error' });
  expect(res.statusCode).toBe(500);
  expect(res.json().error.code).toBe('INTERNAL_ERROR');
  expect(res.body).not.toContain('secret internals');
});

test('zod validation error → 400 VALIDATION_ERROR with issues in details', async () => {
  const res = await app.inject({ method: 'POST', url: '/test/validated', payload: { n: 'x' } });
  expect(res.statusCode).toBe(400);
  const body = res.json();
  expect(body.error.code).toBe('VALIDATION_ERROR');
  expect(body.error.details.issues[0].path).toEqual(['n']);
});

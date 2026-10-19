import { seed } from '@app/db';
import { RunExportV1 } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { strFromU8, unzipSync } from 'fflate';
import { createTestApp } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';
import { createRunRow } from './helpers/fixtures';
import { ACORDAO_TXT, createMockAi } from './helpers/mock-ai';
import { upload } from './helpers/multipart';

const prisma = testPrisma();
let app: FastifyInstance;
let runId: string;
const exportRun = (a: FastifyInstance, id: string, format: string) =>
  a.inject({ method: 'GET', url: `/runs/${id}/export?format=${format}` });

beforeEach(async () => {
  await resetDatabase(prisma);
  await seed(prisma, { uploadDir: '/tmp/unused', corpusDir: '/nonexistent' });
  app = await createTestApp({ ai: createMockAi().ai });
  const documentId = (await upload(app, 'acordao.txt', ACORDAO_TXT)).json().document.id;
  const presetId = (await prisma.preset.findUniqueOrThrow({ where: { slug: 'openai-default' } })).id;
  runId = (await app.inject({ method: 'POST', url: '/runs', payload: { documentId, presetId } })).json().id;
  await app.runQueue.onIdle();
});
afterEach(() => app.close());

test('json export validates against RunExportV1', async () => {
  const res = await exportRun(app, runId, 'json');
  expect(res.headers['content-type']).toContain('application/json');
  expect(res.headers['content-disposition']).toContain(`run-${runId}.json`);
  const parsed = RunExportV1.safeParse(res.json());
  expect(parsed.success).toBe(true);
  expect(parsed.data).toMatchObject({
    schemaVersion: 1,
    run: { id: runId, presetSlug: 'openai-default', status: 'completed' },
  });
  expect(parsed.data!.facts).toHaveLength(3);
  expect(parsed.data!.costs.inputTokens).toBeGreaterThan(0);
});

test('csv export zip has 5 files with BOM', async () => {
  const res = await exportRun(app, runId, 'csv');
  expect(res.headers['content-type']).toContain('application/zip');
  expect(res.headers['content-disposition']).toContain(`run-${runId}.zip`);
  const files = unzipSync(new Uint8Array(res.rawPayload));
  expect(Object.keys(files).sort()).toEqual(['alerts.csv', 'claims.csv', 'facts.csv', 'llm_calls.csv', 'metrics.csv']);
  // strFromU8 decodes with TextDecoder, which drops the BOM: check the raw bytes.
  for (const bytes of Object.values(files)) expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const facts = strFromU8(files['facts.csv']!);
  expect(facts.split('\r\n')[0]).toBe(
    'fact_key,category,label,value_json,confidence,status,uncertainty_reasons,evidence_quotes,pages',
  );
  expect(facts.split('\r\n')).toHaveLength(5);
  expect(strFromU8(files['llm_calls.csv']!).split('\r\n').length).toBe(7);
  expect(strFromU8(files['metrics.csv']!)).toContain('alignmentF1,');
});

test('409 when run not completed', async () => {
  const running = await createRunRow(prisma, 'running');
  const res = await exportRun(app, running.id, 'json');
  expect(res.statusCode).toBe(409);
  expect(res.json().error.code).toBe('RUN_NOT_COMPLETED');
});

test('unknown format is a validation error', async () =>
  expect((await exportRun(app, runId, 'xml')).statusCode).toBe(400));

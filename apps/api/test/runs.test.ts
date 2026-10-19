import { seed } from '@app/db';
import { parsePipelineConfig, RunDto, type StageRunDto } from '@app/shared';
import { APICallError } from 'ai';
import type { FastifyInstance } from 'fastify';
import { configHash } from '../src/runtime/canonical-json';
import { markInterruptedRuns } from '../src/runtime/pipeline-runner';
import { createTestApp } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';
import { ACORDAO_TXT, createMockAi } from './helpers/mock-ai';
import { upload } from './helpers/multipart';

const prisma = testPrisma();
let app: FastifyInstance;
let documentId: string;

const presetId = async (slug: string) => (await prisma.preset.findUniqueOrThrow({ where: { slug } })).id;
const createRun = async (a: FastifyInstance, docId: string, slug: string, extra: object = {}) =>
  a.inject({ method: 'POST', url: '/runs', payload: { documentId: docId, presetId: await presetId(slug), ...extra } });
const getRun = async (a: FastifyInstance, id: string) =>
  RunDto.parse((await a.inject({ method: 'GET', url: `/runs/${id}` })).json());

async function setup(mock = createMockAi(), env = {}) {
  app = await createTestApp({ ai: mock.ai, env });
  documentId = (await upload(app, 'acordao.txt', ACORDAO_TXT)).json().document.id;
  return mock;
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seed(prisma, { uploadDir: '/tmp/unused', corpusDir: '/nonexistent' });
});
afterEach(() => app?.close());

test('provider without key → 400 before queueing (Review Focus 4)', async () => {
  await setup(createMockAi(), { ANTHROPIC_API_KEY: undefined });
  const res = await createRun(app, documentId, 'anthropic-default');
  expect(res.statusCode).toBe(400);
  expect(res.json()).toMatchObject({ error: { code: 'PROVIDER_NOT_CONFIGURED' } });
  expect(await prisma.run.count()).toBe(0);
});

test('unknown document or preset → 404', async () => {
  await setup();
  const res = await app.inject({
    method: 'POST',
    url: '/runs',
    payload: { documentId: crypto.randomUUID(), presetId: await presetId('budget') },
  });
  expect(res.statusCode).toBe(404);
});

test('invalid overrides → 400 VALIDATION_ERROR', async () => {
  await setup();
  const res = await createRun(app, documentId, 'openai-default', {
    configOverrides: { summarization: { targetLength: 'huge' } },
  });
  expect(res.statusCode).toBe(400);
  expect(res.json().error.code).toBe('VALIDATION_ERROR');
});

test('full run with mocks completes', async () => {
  await setup();
  const res = await createRun(app, documentId, 'openai-default', { label: 'teste' });
  expect(res.statusCode).toBe(202);
  const run = RunDto.parse(res.json());
  expect(run.status).toBe('queued');
  expect(run.stages.map((s) => s.status)).toEqual(Array(6).fill('pending'));
  expect(run.configHash).toBe(configHash(parsePipelineConfig({})));
  await app.runQueue.onIdle();
  const done = await getRun(app, run.id);
  expect(done.status).toBe('completed');
  expect(done.stages.every((s: StageRunDto) => s.status === 'completed')).toBe(true);
  expect(done.stages.map((s) => s.stage)).toEqual([
    'text_extraction',
    'information_extraction',
    'summarization',
    'similarity',
    'verification',
    'report',
  ]);
  expect(done.startedAt).not.toBeNull();
  expect(done.finishedAt).not.toBeNull();
  expect(done.totals.inputTokens).toBeGreaterThan(0);
  expect(await prisma.runMetrics.count({ where: { runId: run.id } })).toBe(1);
  expect(await prisma.extractedFact.count()).toBe(3);
  expect(await prisma.llmCall.count({ where: { runId: run.id } })).toBe(5);
  const types = (await prisma.runEvent.findMany({ where: { runId: run.id }, orderBy: { seq: 'asc' } })).map(
    (e) => e.type,
  );
  expect(types[0]).toBe('run.status');
  expect(types.at(-1)).toBe('run.status');
  expect(types.filter((t) => t === 'stage.completed')).toHaveLength(6);
  expect(types).toContain('llm.call');
  const listed = (await app.inject({ method: 'GET', url: `/runs?documentId=${documentId}&label=teste` })).json();
  expect(listed.map((r: { id: string }) => r.id)).toEqual([run.id]);
});

test('stage failure marks run failed with code', async () => {
  const rateLimited = () => {
    throw new APICallError({
      message: 'slow down',
      url: 'x',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: false,
    });
  };
  await setup(createMockAi({ summarizer: rateLimited }));
  const run = (await createRun(app, documentId, 'openai-default')).json();
  await app.runQueue.onIdle();
  const done = await getRun(app, run.id);
  expect(done.status).toBe('failed');
  expect(done.error).toMatchObject({ code: 'RATE_LIMITED' });
  const byStage = Object.fromEntries(done.stages.map((s) => [s.stage, s]));
  expect(byStage.summarization!.status).toBe('failed');
  expect(byStage.summarization!.error?.code).toBe('RATE_LIMITED');
  expect(byStage.similarity!.status).toBe('pending');
  expect(byStage.information_extraction!.status).toBe('completed');
  const last = await prisma.runEvent.findFirstOrThrow({ where: { runId: run.id }, orderBy: { seq: 'desc' } });
  expect(last).toMatchObject({ type: 'run.status' });
  expect((last.data as { status: string }).status).toBe('failed');
});

test('cancel during run → cancelled', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const mock = createMockAi({
    extractor: async (call) => {
      entered();
      await gate;
      return (await import('./helpers/mock-ai')).DEFAULT_RESPONDERS.extractor!(call);
    },
  });
  await setup(mock);
  const run = (await createRun(app, documentId, 'openai-default')).json();
  await started;
  const cancel = await app.inject({ method: 'POST', url: `/runs/${run.id}/cancel` });
  expect(cancel.statusCode).toBe(202);
  release();
  await app.runQueue.onIdle();
  const done = await getRun(app, run.id);
  expect(done.status).toBe('cancelled');
  expect(done.error?.code).toBe('CANCELLED');
  expect((await app.inject({ method: 'POST', url: `/runs/${run.id}/cancel` })).json()).toMatchObject({
    error: { code: 'RUN_NOT_ACTIVE' },
  });
});

test('markInterruptedRuns', async () => {
  await setup();
  const doc = await prisma.document.findFirstOrThrow();
  const config = parsePipelineConfig({});
  const running = await prisma.run.create({
    data: {
      documentId: doc.id,
      status: 'running',
      config,
      configHash: 'h',
      stageRuns: {
        create: [
          { stage: 'text_extraction', status: 'completed' },
          { stage: 'information_extraction', status: 'running' },
        ],
      },
    },
  });
  const queued = await prisma.run.create({ data: { documentId: doc.id, status: 'queued', config, configHash: 'h' } });
  const completed = await prisma.run.create({
    data: { documentId: doc.id, status: 'completed', config, configHash: 'h' },
  });
  expect(await markInterruptedRuns(prisma)).toBe(2);
  expect((await prisma.run.findUniqueOrThrow({ where: { id: running.id } })).status).toBe('interrupted');
  expect((await prisma.run.findUniqueOrThrow({ where: { id: queued.id } })).status).toBe('interrupted');
  expect((await prisma.run.findUniqueOrThrow({ where: { id: completed.id } })).status).toBe('completed');
  const sr = await prisma.stageRun.findFirstOrThrow({ where: { runId: running.id, stage: 'information_extraction' } });
  expect(sr.status).toBe('failed');
  expect((sr.error as { code: string }).code).toBe('INTERRUPTED');
});

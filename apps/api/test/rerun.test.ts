import { seed } from '@app/db';
import { RunDto, type StageRunDto, type Summary } from '@app/shared';
import { APICallError } from 'ai';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';
import { createRunRow } from './helpers/fixtures';
import { ACORDAO_TXT, createMockAi, DEFAULT_RESPONDERS } from './helpers/mock-ai';
import { upload } from './helpers/multipart';

const prisma = testPrisma();
let app: FastifyInstance;
let mock: ReturnType<typeof createMockAi>;
let parentId: string;

const rerun = (a: FastifyInstance, id: string, body: object) =>
  a.inject({ method: 'POST', url: `/runs/${id}/rerun`, payload: body });
const getRun = async (a: FastifyInstance, id: string) =>
  RunDto.parse((await a.inject({ method: 'GET', url: `/runs/${id}` })).json());
const stageOf = (stages: StageRunDto[], stage: string) => stages.find((s) => s.stage === stage)!;

async function startParent(m = createMockAi()) {
  mock = m;
  app = await createTestApp({ ai: mock.ai });
  const documentId = (await upload(app, 'acordao.txt', ACORDAO_TXT)).json().document.id;
  const presetId = (await prisma.preset.findUniqueOrThrow({ where: { slug: 'openai-default' } })).id;
  parentId = (await app.inject({ method: 'POST', url: '/runs', payload: { documentId, presetId } })).json().id;
  await app.runQueue.onIdle();
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seed(prisma, { uploadDir: '/tmp/unused', corpusDir: '/nonexistent' });
});
afterEach(() => app?.close());

test('rerun from summarization reuses earlier checkpoints', async () => {
  await startParent();
  const callsBefore = mock.mockCalls('extractor.court-decision');
  const res = await rerun(app, parentId, {
    fromStage: 'summarization',
    configOverrides: { summarization: { targetLength: 'short' } },
  });
  expect(res.statusCode).toBe(202);
  const child = res.json();
  await app.runQueue.onIdle();
  const done = await getRun(app, child.id);
  expect(done.status).toBe('completed');
  expect(done.parentRunId).toBe(parentId);
  expect(done.startFromStage).toBe('summarization');
  expect(done.config.summarization.targetLength).toBe('short');
  expect(stageOf(done.stages, 'information_extraction').status).toBe('reused');
  expect(stageOf(done.stages, 'text_extraction').status).toBe('reused');
  expect(stageOf(done.stages, 'summarization').status).toBe('completed');
  expect(mock.mockCalls('extractor.court-decision')).toBe(callsBefore);
  const parent = await getRun(app, parentId);
  expect(stageOf(done.stages, 'information_extraction').reusedFromStageRunId).toBe(
    stageOf(parent.stages, 'information_extraction').id,
  );
});

test('reuse is resolved transitively', async () => {
  await startParent();
  const child = (await rerun(app, parentId, { fromStage: 'summarization' })).json();
  await app.runQueue.onIdle();
  const grandchild = (await rerun(app, child.id, { fromStage: 'similarity' })).json();
  await app.runQueue.onIdle();
  const parent = await getRun(app, parentId);
  const g = await getRun(app, grandchild.id);
  expect(stageOf(g.stages, 'text_extraction').reusedFromStageRunId).toBe(stageOf(parent.stages, 'text_extraction').id);
  expect(stageOf(g.stages, 'summarization').reusedFromStageRunId).toBe(
    stageOf((await getRun(app, child.id)).stages, 'summarization').id,
  );
});

test('override before fromStage → 400 OVERRIDE_BEFORE_FROM_STAGE', async () => {
  await startParent();
  const res = await rerun(app, parentId, {
    fromStage: 'summarization',
    configOverrides: { extraction: { strategy: 'chunked' } },
  });
  expect(res.statusCode).toBe(400);
  expect(res.json().error.code).toBe('OVERRIDE_BEFORE_FROM_STAGE');
});

const override: Summary = {
  title: 'Resumo alterado',
  overview: 'O tribunal deu provimento ao recurso.',
  sections: [
    { heading: 'O que o tribunal decidiu', paragraphs: [{ text: 'O prazo é de 30 dias.', factRefs: ['F01'] }] },
  ],
  glossary: [],
};

test('summaryOverride requires fromStage similarity', async () => {
  await startParent();
  const res = await rerun(app, parentId, { fromStage: 'verification', summaryOverride: override });
  expect(res.statusCode).toBe(400);
  expect(res.json().error.code).toBe('VALIDATION_ERROR');
});

test('summaryOverride marks summarization overridden and stores the given summary', async () => {
  await startParent();
  const fault = {
    type: 'deadline_change',
    description: 'prazo dobrado',
    expected: { alertType: 'divergence', category: 'deadline' },
  };
  const child = (
    await rerun(app, parentId, {
      fromStage: 'similarity',
      summaryOverride: override,
      label: 'eval-faults',
      injectedFaults: [fault],
    })
  ).json();
  await app.runQueue.onIdle();
  const done = await getRun(app, child.id);
  expect(done.status).toBe('completed');
  expect(done.label).toBe('eval-faults');
  expect(done.injectedFaults).toEqual([fault]);
  expect(stageOf(done.stages, 'summarization').status).toBe('overridden');
  const result = (await app.inject({ method: 'GET', url: `/runs/${child.id}/result` })).json();
  expect(result.summary.summary.title).toBe('Resumo alterado');
  expect(result.summary.compressionRatio).toBeGreaterThan(1);
  expect(await prisma.summary.count({ where: { stageRunId: stageOf(done.stages, 'summarization').id } })).toBe(1);
});

test('parent still running → 409 RUN_NOT_COMPLETED', async () => {
  await startParent();
  const running = await createRunRow(prisma, 'running');
  const res = await rerun(app, running.id, { fromStage: 'summarization' });
  expect(res.statusCode).toBe(409);
  expect(res.json().error.code).toBe('RUN_NOT_COMPLETED');
});

test('missing checkpoint before fromStage → 400 MISSING_CHECKPOINT', async () => {
  let calls = 0;
  await startParent(
    createMockAi({
      summarizer: () => {
        calls++;
        throw new APICallError({
          message: 'down',
          url: 'x',
          requestBodyValues: {},
          statusCode: 500,
          isRetryable: false,
        });
      },
    }),
  );
  expect(calls).toBe(1);
  const res = await rerun(app, parentId, { fromStage: 'similarity' });
  expect(res.statusCode).toBe(400);
  expect(res.json().error.code).toBe('MISSING_CHECKPOINT');
});

test('retry after failure completes', async () => {
  let calls = 0;
  await startParent(
    createMockAi({
      summarizer: (call) => {
        if (calls++ === 0)
          throw new APICallError({
            message: 'slow',
            url: 'x',
            requestBodyValues: {},
            statusCode: 429,
            isRetryable: false,
          });
        return DEFAULT_RESPONDERS.summarizer!(call);
      },
    }),
  );
  expect((await getRun(app, parentId)).status).toBe('failed');
  const child = (await rerun(app, parentId, { fromStage: 'summarization' })).json();
  await app.runQueue.onIdle();
  expect((await getRun(app, child.id)).status).toBe('completed');
});

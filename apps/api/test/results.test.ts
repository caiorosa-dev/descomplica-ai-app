import { seed } from '@app/db';
import { LlmCallDto, LlmCallSummaryDto, RunResultDto, RunTextDto } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';
import { ACORDAO_TXT, createMockAi } from './helpers/mock-ai';
import { upload } from './helpers/multipart';

const prisma = testPrisma();
let app: FastifyInstance;
let runId: string;

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

test('result route returns the run outputs', async () => {
  const result = RunResultDto.parse((await app.inject({ method: 'GET', url: `/runs/${runId}/result` })).json());
  expect(result.classification?.documentType).toBe('court_decision');
  expect(result.facts).toHaveLength(3);
  expect(result.summary?.summary.title).toBe('STJ mantém decisão');
  expect(result.similarity?.headline.metric).toBe('alignment_f1');
  expect(result.claims.length).toBeGreaterThan(0);
  expect(result.items.length).toBeGreaterThan(0);
  expect(result.metrics?.factsConfirmed).toBe(3);
});

test('result of reused run equals parent facts', async () => {
  const child = (
    await app.inject({ method: 'POST', url: `/runs/${runId}/rerun`, payload: { fromStage: 'summarization' } })
  ).json();
  await app.runQueue.onIdle();
  const parentResult = (await app.inject({ method: 'GET', url: `/runs/${runId}/result` })).json();
  const childResult = (await app.inject({ method: 'GET', url: `/runs/${child.id}/result` })).json();
  expect(childResult.facts).toEqual(parentResult.facts);
});

test('result of a queued run has empty fields', async () => {
  const run = await prisma.run.create({
    data: { documentId: (await prisma.document.findFirstOrThrow()).id, status: 'queued', config: {}, configHash: 'h' },
  });
  const result = RunResultDto.parse((await app.inject({ method: 'GET', url: `/runs/${run.id}/result` })).json());
  expect(result).toMatchObject({ classification: null, facts: [], summary: null, similarity: null, metrics: null });
});

test('text route returns canonical text and coverage', async () => {
  const text = RunTextDto.parse((await app.inject({ method: 'GET', url: `/runs/${runId}/text` })).json());
  expect(text.canonicalText).toContain('nego provimento ao recurso especial');
  expect(text.sections.length).toBeGreaterThan(0);
  expect(text.coverageByChunk?.length).toBeGreaterThan(0);
  const chunk = text.coverageByChunk![0]!;
  expect(chunk.end).toBeGreaterThan(chunk.start);
  expect(text.supportByParagraph?.[0]?.chunkId).toBe('P00');
});

test('llm-calls list and detail', async () => {
  const list = LlmCallSummaryDto.array().parse(
    (await app.inject({ method: 'GET', url: `/runs/${runId}/llm-calls` })).json(),
  );
  expect(list.map((c) => c.agent)).toEqual([
    'classifier',
    'extractor.court-decision',
    'summarizer',
    'claim-extractor',
    'verifier',
  ]);
  const detail = LlmCallDto.parse(
    (await app.inject({ method: 'GET', url: `/runs/${runId}/llm-calls/${list[0]!.id}` })).json(),
  );
  expect(JSON.stringify(detail.messages)).toContain('Brazilian Portuguese');
  expect(detail.parsedOutput).toMatchObject({ documentType: 'court_decision' });
  expect((await app.inject({ method: 'GET', url: `/runs/${runId}/llm-calls/${crypto.randomUUID()}` })).statusCode).toBe(
    404,
  );
});

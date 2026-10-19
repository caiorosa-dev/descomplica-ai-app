import { seed } from '@app/db';
import { CrossSimilarityDto, MODEL_REFS } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';
import { createRunRow } from './helpers/fixtures';
import { ACORDAO_TXT, createMockAi, DEFAULT_RESPONDERS } from './helpers/mock-ai';
import { upload } from './helpers/multipart';

const prisma = testPrisma();
let app: FastifyInstance;

const RESOLUCAO_TXT = [
  'RESOLUÇÃO Nº 1, DE 2 DE JANEIRO DE 2026',
  'Institui o programa de reciclagem de papel e de coleta seletiva de resíduos nos tribunais.',
  'Art. 1º Fica instituído o programa de reciclagem de papel, plástico e metal nas unidades dos tribunais.',
  'Art. 2º Cada tribunal deve instalar coletores de resíduos recicláveis em todos os prédios.',
].join('\n\n');
const RECYCLING_SUMMARY = {
  title: 'Programa de reciclagem',
  overview: 'A resolução cria um programa de reciclagem de papel, plástico e metal nos tribunais.',
  sections: [
    {
      heading: 'Do que trata',
      paragraphs: [{ text: 'Cada tribunal deve instalar coletores de resíduos recicláveis.', factRefs: [] }],
    },
  ],
  glossary: [],
};

async function completedRun(filename: string, text: string, overrides: object = {}) {
  const documentId = (await upload(app, filename, text)).json().document.id;
  const presetId = (await prisma.preset.findUniqueOrThrow({ where: { slug: 'openai-default' } })).id;
  const id = (
    await app.inject({ method: 'POST', url: '/runs', payload: { documentId, presetId, configOverrides: overrides } })
  ).json().id;
  await app.runQueue.onIdle();
  return id as string;
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seed(prisma, { uploadDir: '/tmp/unused', corpusDir: '/nonexistent' });
  const mock = createMockAi({
    summarizer: (call) =>
      call.prompt.includes('RESOLUÇÃO') ? RECYCLING_SUMMARY : DEFAULT_RESPONDERS.summarizer!(call),
  });
  app = await createTestApp({ ai: mock.ai });
});
afterEach(() => app.close());

test('2x2 matrix with dominant diagonal under fake embeddings', async () => {
  const runA = await completedRun('a.txt', ACORDAO_TXT);
  const runB = await completedRun('b.txt', RESOLUCAO_TXT);
  const res = await app.inject({
    method: 'POST',
    url: '/analysis/cross-similarity',
    payload: { runIds: [runA, runB] },
  });
  expect(res.statusCode).toBe(200);
  const body = CrossSimilarityDto.parse(res.json());
  expect(body.runIds).toEqual([runA, runB]);
  expect(body.documentIds).toHaveLength(2);
  const m = body.matrix;
  expect(m[0]![0]!).toBeGreaterThan(m[0]![1]!);
  expect(m[1]![1]!).toBeGreaterThan(m[1]![0]!);
});

test('mixed embedding models → 400 MIXED_EMBEDDING_MODELS', async () => {
  const runA = await completedRun('a.txt', ACORDAO_TXT);
  const runB = await completedRun('b.txt', RESOLUCAO_TXT, {
    similarity: { embeddingModel: MODEL_REFS.embeddingLarge },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/analysis/cross-similarity',
    payload: { runIds: [runA, runB] },
  });
  expect(res.statusCode).toBe(400);
  expect(res.json().error.code).toBe('MIXED_EMBEDDING_MODELS');
});

test('run without similarity output → 409 RUN_NOT_COMPLETED', async () => {
  const runA = await completedRun('a.txt', ACORDAO_TXT);
  const queued = await createRunRow(prisma, 'queued');
  const res = await app.inject({
    method: 'POST',
    url: '/analysis/cross-similarity',
    payload: { runIds: [runA, queued.id] },
  });
  expect(res.statusCode).toBe(409);
  expect(res.json().error.code).toBe('RUN_NOT_COMPLETED');
});

test('needs at least two runs', async () =>
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/analysis/cross-similarity',
        payload: { runIds: [crypto.randomUUID()] },
      })
    ).statusCode,
  ).toBe(400));

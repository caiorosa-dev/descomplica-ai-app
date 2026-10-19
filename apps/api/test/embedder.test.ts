import type { EmbeddingCallRecord } from '@app/pipeline';
import { MODEL_REFS } from '@app/shared';
import { createEmbedder, type EmbedManyFn } from '../src/runtime/adapters/embedder';
import { createModelResolver } from '../src/runtime/adapters/model-resolver';
import { testEnv } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

test('embedder caches by model/dimensions/text hash', async () => {
  const calls: string[][] = [];
  const embedMany: EmbedManyFn = async ({ values }) => {
    calls.push(values);
    return { embeddings: values.map((v) => [v.length, 0.5]), tokens: values.length };
  };
  const records: EmbeddingCallRecord[] = [];
  const e = createEmbedder({
    prisma,
    embedMany,
    onCall: async (r) => {
      records.push(r);
    },
  });
  const first = await e.embed(['a', 'b'], { model: MODEL_REFS.embeddingSmall, dimensions: null });
  const second = await e.embed(['b', 'c', 'a'], { model: MODEL_REFS.embeddingSmall, dimensions: null });
  expect(calls).toEqual([['a', 'b'], ['c']]);
  expect(second).toHaveLength(3);
  expect(second[0]).toEqual(first[1]);
  expect(second[2]).toEqual(first[0]);
  expect(records[1]!.cacheHits).toBe(2);
  expect(records[1]).toMatchObject({ model: MODEL_REFS.embeddingSmall, inputCount: 3, tokens: 1 });
  expect(await prisma.embeddingCache.count()).toBe(3);
});

test('different dimensions do not share the cache; duplicates are embedded once', async () => {
  const calls: { values: string[]; dimensions: number | null }[] = [];
  const embedMany: EmbedManyFn = async ({ values, dimensions }) => {
    calls.push({ values, dimensions });
    return { embeddings: values.map(() => [1, 0]), tokens: 1 };
  };
  const e = createEmbedder({ prisma, embedMany, onCall: async () => {} });
  await e.embed(['x', 'x'], { model: MODEL_REFS.embeddingSmall, dimensions: null });
  await e.embed(['x'], { model: MODEL_REFS.embeddingSmall, dimensions: 256 });
  expect(calls).toEqual([
    { values: ['x'], dimensions: null },
    { values: ['x'], dimensions: 256 },
  ]);
});

test('misses are sent in batches of 100', async () => {
  const sizes: number[] = [];
  const embedMany: EmbedManyFn = async ({ values }) => {
    sizes.push(values.length);
    return { embeddings: values.map(() => [1]), tokens: values.length };
  };
  const e = createEmbedder({ prisma, embedMany, onCall: async () => {} });
  await e.embed(
    Array.from({ length: 250 }, (_, i) => `t${i}`),
    { model: MODEL_REFS.embeddingSmall, dimensions: null },
  );
  expect(sizes).toEqual([100, 100, 50]);
});

test('resolver throws PROVIDER_NOT_CONFIGURED without key', () =>
  expect(() =>
    createModelResolver(testEnv({ ANTHROPIC_API_KEY: undefined })).resolve(MODEL_REFS.anthropicMain),
  ).toThrow(expect.objectContaining({ code: 'PROVIDER_NOT_CONFIGURED' })));

test('resolver returns language models for configured providers', () => {
  const model = createModelResolver(testEnv()).resolve(MODEL_REFS.openaiMain);
  expect(typeof model === 'object' && 'modelId' in model ? model.modelId : model).toBe('gpt-5.6-sol');
});

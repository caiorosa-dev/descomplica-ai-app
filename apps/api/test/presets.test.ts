import { seed } from '@app/db';
import { MODEL_REFS, PresetDto } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';

const prisma = testPrisma();
let app: FastifyInstance;
const presetId = async (slug: string) => (await prisma.preset.findUniqueOrThrow({ where: { slug } })).id;

beforeEach(async () => {
  await resetDatabase(prisma);
  await seed(prisma, { uploadDir: '/tmp/unused', corpusDir: '/nonexistent-corpus' });
  app = await createTestApp();
});
afterEach(() => app.close());

test('lists builtin presets with parsed configs', async () => {
  const list = PresetDto.array().parse((await app.inject({ method: 'GET', url: '/presets' })).json());
  expect(list.map((p) => p.slug)).toEqual(['openai-default', 'anthropic-default', 'cross-verifier', 'budget']);
  expect(list.every((p) => p.isBuiltin)).toBe(true);
  expect(list[0]!.config.extraction.maxSinglePassTokens).toBe(60_000);
});

test('invalid config → 400 with issue path', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/presets',
    payload: {
      slug: 'x',
      name: 'X',
      description: '',
      config: { models: { extraction: { model: MODEL_REFS.embeddingSmall } } },
    },
  });
  expect(res.statusCode).toBe(400);
  expect(JSON.stringify(res.json().error.details)).toContain('extraction');
  expect(res.json().error.details.issues[0].path).toEqual(['config', 'models', 'extraction', 'model']);
});

test('create, get, update and delete a custom preset', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/presets',
    payload: {
      slug: 'meu-preset',
      name: 'Meu',
      description: 'teste',
      config: { summarization: { targetLength: 'short' } },
    },
  });
  expect(created.statusCode).toBe(201);
  const preset = PresetDto.parse(created.json());
  expect(preset.config.summarization.targetLength).toBe('short');
  expect(preset.isBuiltin).toBe(false);
  const updated = await app.inject({ method: 'PUT', url: `/presets/${preset.id}`, payload: { name: 'Novo nome' } });
  expect(updated.json()).toMatchObject({ name: 'Novo nome', slug: 'meu-preset' });
  expect((await app.inject({ method: 'DELETE', url: `/presets/${preset.id}` })).statusCode).toBe(204);
  expect((await app.inject({ method: 'GET', url: `/presets/${preset.id}` })).statusCode).toBe(404);
});

test('duplicated slug → 400 with slug issue', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/presets',
    payload: { slug: 'budget', name: 'X', description: '', config: {} },
  });
  expect(res.statusCode).toBe(400);
  expect(res.json().error.details.issues[0].path).toEqual(['slug']);
});

test('invalid slug format is rejected', async () =>
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/presets',
        payload: { slug: 'Com Espaço', name: 'X', description: '', config: {} },
      })
    ).statusCode,
  ).toBe(400));

test('builtin is read-only', async () => {
  const id = await presetId('openai-default');
  expect((await app.inject({ method: 'PUT', url: `/presets/${id}`, payload: { name: 'y' } })).json()).toMatchObject({
    error: { code: 'PRESET_READ_ONLY' },
  });
  expect((await app.inject({ method: 'DELETE', url: `/presets/${id}` })).statusCode).toBe(409);
});

test('duplicate builtin', async () => {
  const id = await presetId('openai-default');
  const res = await app.inject({ method: 'POST', url: `/presets/${id}/duplicate` });
  expect(res.statusCode).toBe(201);
  expect(res.json()).toMatchObject({ slug: 'openai-default-copy', isBuiltin: false, name: 'OpenAI (padrão) (cópia)' });
  expect((await app.inject({ method: 'POST', url: `/presets/${id}/duplicate` })).json().slug).toBe(
    'openai-default-copy-2',
  );
  expect((await app.inject({ method: 'POST', url: `/presets/${id}/duplicate` })).json().slug).toBe(
    'openai-default-copy-3',
  );
});

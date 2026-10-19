import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { seed } from '@app/db';
import { resetDatabase, testPrisma } from './helpers/db';

const prisma = testPrisma();
const fixtureCorpus = resolve(import.meta.dirname, 'fixtures/corpus');
beforeEach(() => resetDatabase(prisma));

test('seed is idempotent', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'seed-'));
  const a = await seed(prisma, { uploadDir: tmp, corpusDir: fixtureCorpus });
  const b = await seed(prisma, { uploadDir: tmp, corpusDir: fixtureCorpus });
  expect(a).toEqual(b);
  expect(a).toEqual({ presets: 4, documents: 2 });
  expect(await prisma.preset.count()).toBe(4);
  expect(await prisma.document.count()).toBe(a.documents);
  const docs = await prisma.document.findMany({ orderBy: { corpusKey: 'asc' } });
  expect(docs.map((d) => [d.corpusKey, d.source, d.mimeType])).toEqual([
    ['cnj-res-1-2024', 'corpus', 'text/plain'],
    ['stj-resp-1-sp', 'corpus', 'text/plain'],
  ]);
  expect(readdirSync(tmp)).toHaveLength(2);
});

test('missing corpus dir seeds presets only and logs it', async () => {
  const logs: string[] = [];
  const r = await seed(prisma, { uploadDir: '/tmp/x', corpusDir: '/does/not/exist', log: (m) => logs.push(m) });
  expect(r).toEqual({ presets: 4, documents: 0 });
  expect(logs.join('\n')).toContain('/does/not/exist');
});

test('seed updates builtin configs in place', async () => {
  await seed(prisma, { uploadDir: '/tmp/x', corpusDir: '/does/not/exist' });
  await prisma.preset.update({ where: { slug: 'budget' }, data: { config: {} } });
  await seed(prisma, { uploadDir: '/tmp/x', corpusDir: '/does/not/exist' });
  const budget = await prisma.preset.findUniqueOrThrow({ where: { slug: 'budget' } });
  expect((budget.config as { models: { extraction: { model: string } } }).models.extraction.model).toBe(
    'openai:gpt-5.6-luna',
  );
});

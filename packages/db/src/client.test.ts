import { buildStoragePath, createPrismaClient } from './index';

const db = createPrismaClient(process.env.TEST_DATABASE_URL);

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "documents" CASCADE');
});

afterAll(async () => {
  await db.$disconnect();
});

test('persists a run with stage runs and enforces unique event seq', async () => {
  const doc = await db.document.create({
    data: {
      filename: 'a.txt',
      mimeType: 'text/plain',
      sizeBytes: 3,
      sha256: 'x',
      storagePath: '/tmp/x.txt',
      source: 'upload',
    },
  });
  const run = await db.run.create({ data: { documentId: doc.id, status: 'queued', config: {}, configHash: 'h' } });
  await db.runEvent.create({ data: { runId: run.id, seq: 1, type: 'run.status', data: {} } });
  await expect(db.runEvent.create({ data: { runId: run.id, seq: 1, type: 'log', data: {} } })).rejects.toThrow();
});

test('buildStoragePath', () => expect(buildStoragePath('/data/uploads', 'abc', 'pdf')).toBe('/data/uploads/abc.pdf'));

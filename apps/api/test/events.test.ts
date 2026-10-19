import type { RunEventInput } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { createEventBus, type EventBus } from '../src/runtime/event-bus';
import { createEventRecorder } from '../src/runtime/event-recorder';
import { createTestApp } from './helpers/app';
import { resetDatabase, testPrisma } from './helpers/db';
import { createRunRow, parseSse } from './helpers/fixtures';

const prisma = testPrisma();
let app: FastifyInstance;
let bus: EventBus;
let runId: string;

const log = (message: string): RunEventInput => ({ type: 'log', runId, stage: null, level: 'info', message });
async function seedEvents(id: string, specs: string[]) {
  const recorder = await createEventRecorder(prisma, createEventBus(), id);
  for (const spec of specs) {
    const [type, status] = spec.split(':');
    if (type === 'run.status')
      await recorder.emit({ type: 'run.status', runId: id, stage: null, status: status as 'running' });
    else await recorder.emit({ type: 'stage.started', runId: id, stage: 'text_extraction' });
  }
}
const markRun = (id: string, status: 'completed' | 'running') => prisma.run.update({ where: { id }, data: { status } });

beforeEach(async () => {
  await resetDatabase(prisma);
  app = await createTestApp();
  bus = app.eventBus;
  runId = (await createRunRow(prisma)).id;
});
afterEach(() => app.close());

test('recorder assigns sequential seq and resumes from db max', async () => {
  const r1 = await createEventRecorder(prisma, bus, runId);
  expect((await Promise.all([r1.emit(log('a')), r1.emit(log('b'))])).map((e) => e.seq)).toEqual([1, 2]);
  expect((await (await createEventRecorder(prisma, bus, runId)).emit(log('c'))).seq).toBe(3);
  const rows = await prisma.runEvent.findMany({ where: { runId }, orderBy: { seq: 'asc' } });
  expect(rows.map((r) => (r.data as { message: string }).message)).toEqual(['a', 'b', 'c']);
});

test('recorder publishes on the bus', async () => {
  const seen: number[] = [];
  const unsubscribe = bus.subscribe(runId, (e) => seen.push(e.seq));
  const r = await createEventRecorder(prisma, bus, runId);
  await r.emit(log('a'));
  unsubscribe();
  await r.emit(log('b'));
  expect(seen).toEqual([1]);
});

test('completed run: replays everything then closes', async () => {
  await seedEvents(runId, ['run.status:running', 'stage.started', 'run.status:completed']);
  await markRun(runId, 'completed');
  const res = await app.inject({ method: 'GET', url: `/runs/${runId}/events` });
  expect(res.headers['content-type']).toContain('text/event-stream');
  const events = parseSse(res.body);
  expect(events.map((e) => e.id)).toEqual(['1', '2', '3']);
  expect(events.map((e) => e.event)).toEqual(['run.status', 'stage.started', 'run.status']);
  expect(events[1]!.data).toMatchObject({ type: 'stage.started', seq: 2, stage: 'text_extraction', runId });
});

test('Last-Event-ID resumes after seq', async () => {
  await seedEvents(runId, ['run.status:running', 'stage.started', 'run.status:completed']);
  await markRun(runId, 'completed');
  const res = await app.inject({ method: 'GET', url: `/runs/${runId}/events`, headers: { 'last-event-id': '2' } });
  expect(parseSse(res.body).map((e) => e.id)).toEqual(['3']);
  const viaQuery = await app.inject({ method: 'GET', url: `/runs/${runId}/events?lastEventId=1` });
  expect(parseSse(viaQuery.body).map((e) => e.id)).toEqual(['2', '3']);
});

test('live events arrive exactly once', async () => {
  await seedEvents(runId, ['run.status:running']);
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const res = await fetch(`${address}/runs/${runId}/events`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let body = '';
  const recorder = await createEventRecorder(prisma, bus, runId);
  const readUntil = async (predicate: () => boolean) => {
    while (!predicate()) {
      const { value, done } = await reader.read();
      if (done) break;
      body += decoder.decode(value);
    }
  };
  await readUntil(() => body.includes('id: 1'));
  await recorder.emit({ type: 'stage.started', runId, stage: 'text_extraction' });
  await markRun(runId, 'completed');
  await recorder.emit({ type: 'run.status', runId, stage: null, status: 'completed' });
  await readUntil(() => false);
  expect(parseSse(body).map((e) => e.id)).toEqual(['1', '2', '3']);
});

test('404 for unknown run', async () => {
  const res = await app.inject({ method: 'GET', url: `/runs/${crypto.randomUUID()}/events` });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
});

import { parsePipelineConfig, type RunDto, type RunEvent, STAGE_ORDER } from '@app/shared';
import { applyRunEvent, initialLiveState } from './events-reducer';

const runId = '00000000-0000-4000-8000-000000000001';
const queuedRun: RunDto = {
  id: runId,
  documentId: crypto.randomUUID(),
  presetId: null,
  parentRunId: null,
  startFromStage: null,
  label: null,
  status: 'queued',
  config: parsePipelineConfig({}),
  configHash: 'h',
  injectedFaults: null,
  error: null,
  createdAt: '2026-10-18T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  stages: STAGE_ORDER.map((stage) => ({
    id: crypto.randomUUID(),
    stage,
    status: 'pending',
    reusedFromStageRunId: null,
    durationMs: null,
    metrics: null,
    warnings: [],
    error: null,
  })),
  totals: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
};

type Body = { type: RunEvent['type'] } & Record<string, unknown>;
const ev = (seq: number, body: Body): RunEvent =>
  ({ runId, seq, createdAt: `2026-10-18T00:00:0${seq % 10}Z`, stage: null, ...body }) as RunEvent;

test('stage lifecycle', () => {
  let s = initialLiveState(queuedRun);
  s = applyRunEvent(s, ev(1, { type: 'stage.started', stage: 'text_extraction' }));
  s = applyRunEvent(
    s,
    ev(2, { type: 'stage.progress', stage: 'text_extraction', message: 'Removendo cabeçalhos', current: 2, total: 6 }),
  );
  expect(s.stages.text_extraction).toMatchObject({
    status: 'running',
    lastMessage: 'Removendo cabeçalhos',
    current: 2,
    total: 6,
  });
  s = applyRunEvent(
    s,
    ev(3, { type: 'stage.completed', stage: 'text_extraction', durationMs: 1200, metrics: { words: 10 } }),
  );
  expect(s.stages.text_extraction).toMatchObject({
    status: 'completed',
    durationMs: 1200,
    metrics: { words: 10 },
    current: null,
    total: null,
  });
  expect(s.lastSeq).toBe(3);
});

test('duplicate seq ignored', () => {
  let s = initialLiveState(queuedRun);
  s = applyRunEvent(s, ev(1, { type: 'log', level: 'info', message: 'a' }));
  const same = applyRunEvent(s, ev(1, { type: 'log', level: 'info', message: 'a' }));
  expect(same).toBe(s);
  expect(applyRunEvent(s, ev(0, { type: 'run.status', status: 'failed' })).status).toBe('queued');
});

test('run.status updates status; llm.call appended; stage.reused sets reused', () => {
  let s = initialLiveState(queuedRun);
  s = applyRunEvent(s, ev(1, { type: 'run.status', status: 'running' }));
  s = applyRunEvent(s, ev(2, { type: 'stage.reused', stage: 'text_extraction', fromStageRunId: 'x' }));
  s = applyRunEvent(
    s,
    ev(3, {
      type: 'llm.call',
      stage: 'information_extraction',
      callId: 'c1',
      agent: 'classifier',
      model: 'gpt',
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.001,
      latencyMs: 300,
      status: 'success',
    }),
  );
  s = applyRunEvent(s, ev(4, { type: 'log', stage: 'information_extraction', level: 'warn', message: 'aviso' }));
  expect(s.status).toBe('running');
  expect(s.stages.text_extraction.status).toBe('reused');
  expect(s.llmCalls.map((c) => c.callId)).toEqual(['c1']);
  expect(s.logs).toEqual([{ level: 'warn', message: 'aviso', createdAt: expect.any(String) }]);
});

test('stage.failed keeps the user message', () => {
  const s = applyRunEvent(
    initialLiveState(queuedRun),
    ev(1, {
      type: 'stage.failed',
      stage: 'summarization',
      error: { code: 'RATE_LIMITED', message: 'x', userMessage: 'Limite atingido.' },
    }),
  );
  expect(s.stages.summarization).toMatchObject({ status: 'failed', lastMessage: 'Limite atingido.' });
});

test('initial state mirrors the run DTO', () => {
  const s = initialLiveState({
    ...queuedRun,
    status: 'completed',
    stages: queuedRun.stages.map((st) => ({ ...st, status: 'completed', durationMs: 5 })),
  });
  expect(s.status).toBe('completed');
  expect(Object.values(s.stages).every((st) => st.status === 'completed' && st.durationMs === 5)).toBe(true);
  expect(s.lastSeq).toBe(0);
});

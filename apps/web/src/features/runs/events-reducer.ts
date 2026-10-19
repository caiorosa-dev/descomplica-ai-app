import {
  type RunDto,
  type RunEvent,
  type RunStatus,
  STAGE_ORDER,
  type StageName,
  type StageRunStatus,
} from '@app/shared';

export interface LiveStage {
  status: StageRunStatus;
  lastMessage: string | null;
  current: number | null;
  total: number | null;
  durationMs: number | null;
  metrics: unknown;
}

export type LlmCallEvent = Extract<RunEvent, { type: 'llm.call' }>;

export interface RunLiveState {
  status: RunStatus;
  stages: Record<StageName, LiveStage>;
  logs: { level: string; message: string; createdAt: string }[];
  llmCalls: LlmCallEvent[];
  lastSeq: number;
}

export function initialLiveState(run: RunDto): RunLiveState {
  const stages = Object.fromEntries(
    STAGE_ORDER.map((stage) => {
      const sr = run.stages.find((s) => s.stage === stage);
      const live: LiveStage = {
        status: sr?.status ?? 'pending',
        lastMessage: sr?.error?.userMessage ?? null,
        current: null,
        total: null,
        durationMs: sr?.durationMs ?? null,
        metrics: sr?.metrics ?? null,
      };
      return [stage, live];
    }),
  ) as Record<StageName, LiveStage>;
  return { status: run.status, stages, logs: [], llmCalls: [], lastSeq: 0 };
}

function patchStage(state: RunLiveState, stage: StageName, patch: Partial<LiveStage>): RunLiveState['stages'] {
  return { ...state.stages, [stage]: { ...state.stages[stage], ...patch } };
}

/** Pure reducer of SSE events into the live view of a run; events already applied (seq ≤ lastSeq) are ignored. */
export function applyRunEvent(state: RunLiveState, event: RunEvent): RunLiveState {
  if (event.seq <= state.lastSeq) return state;
  const next = { ...state, lastSeq: event.seq };
  switch (event.type) {
    case 'run.status':
      return { ...next, status: event.status };
    case 'stage.started':
      return {
        ...next,
        stages: patchStage(state, event.stage, { status: 'running', lastMessage: null, current: null, total: null }),
      };
    case 'stage.progress':
      return {
        ...next,
        stages: patchStage(state, event.stage, {
          status: 'running',
          lastMessage: event.message,
          current: event.current ?? null,
          total: event.total ?? null,
        }),
      };
    case 'stage.completed':
      return {
        ...next,
        stages: patchStage(state, event.stage, {
          status: 'completed',
          durationMs: event.durationMs,
          metrics: event.metrics,
          current: null,
          total: null,
        }),
      };
    case 'stage.failed':
      return {
        ...next,
        stages: patchStage(state, event.stage, { status: 'failed', lastMessage: event.error.userMessage }),
      };
    case 'stage.reused':
      return { ...next, stages: patchStage(state, event.stage, { status: 'reused' }) };
    case 'log':
      return {
        ...next,
        logs: [...state.logs, { level: event.level, message: event.message, createdAt: event.createdAt }],
      };
    case 'llm.call':
      return { ...next, llmCalls: [...state.llmCalls, event] };
  }
}

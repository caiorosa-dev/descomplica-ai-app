import { z } from 'zod';
import { RunStatus, StageName } from './domain/enums';

const LogLevel = z.enum(['debug', 'info', 'warn', 'error']);

export const StageError = z.object({ code: z.string(), message: z.string(), userMessage: z.string() });
export type StageError = z.infer<typeof StageError>;

const variants = {
  'run.status': { stage: z.null(), status: RunStatus },
  'stage.started': { stage: StageName },
  'stage.progress': {
    stage: StageName,
    message: z.string(),
    current: z.number().int().optional(),
    total: z.number().int().optional(),
  },
  'stage.completed': { stage: StageName, durationMs: z.number().int(), metrics: z.record(z.string(), z.unknown()) },
  'stage.failed': { stage: StageName, error: StageError },
  'stage.reused': { stage: StageName, fromStageRunId: z.string() },
  log: { stage: StageName.nullable(), level: LogLevel, message: z.string(), data: z.unknown().optional() },
  'llm.call': {
    stage: StageName.nullable(),
    callId: z.string(),
    agent: z.string(),
    model: z.string(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    costUsd: z.number(),
    latencyMs: z.number().int(),
    status: z.enum(['success', 'error']),
  },
} as const;

const inputBase = { runId: z.string() };
const storedBase = { ...inputBase, seq: z.number().int(), createdAt: z.string() };

function union<const B extends z.ZodRawShape>(base: B) {
  return z.discriminatedUnion('type', [
    z.object({ ...base, type: z.literal('run.status'), ...variants['run.status'] }),
    z.object({ ...base, type: z.literal('stage.started'), ...variants['stage.started'] }),
    z.object({ ...base, type: z.literal('stage.progress'), ...variants['stage.progress'] }),
    z.object({ ...base, type: z.literal('stage.completed'), ...variants['stage.completed'] }),
    z.object({ ...base, type: z.literal('stage.failed'), ...variants['stage.failed'] }),
    z.object({ ...base, type: z.literal('stage.reused'), ...variants['stage.reused'] }),
    z.object({ ...base, type: z.literal('log'), ...variants.log }),
    z.object({ ...base, type: z.literal('llm.call'), ...variants['llm.call'] }),
  ]);
}

/** Event of a run, as stored in `RunEvent` and streamed over SSE (spec §7). */
export const RunEvent = union(storedBase);
export type RunEvent = z.infer<typeof RunEvent>;

/** A run event before the recorder assigns `seq` and `createdAt`. */
export const RunEventInput = union(inputBase);
export type RunEventInput = z.infer<typeof RunEventInput>;

export type RunEventType = RunEvent['type'];

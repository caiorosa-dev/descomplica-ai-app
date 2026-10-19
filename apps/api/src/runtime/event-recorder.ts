import type { Prisma, PrismaClient, RunEvent as RunEventRow } from '@app/db';
import { RunEvent, type RunEventInput } from '@app/shared';
import type { EventBus } from './event-bus';

export interface RunEventRecorder {
  emit(event: RunEventInput): Promise<RunEvent>;
}

/** Rebuilds the event from its row: type, stage and seq are columns; the other fields live in `data`. */
export function rowToEvent(row: RunEventRow): RunEvent {
  return RunEvent.parse({
    ...(row.data as object),
    type: row.type,
    runId: row.runId,
    seq: row.seq,
    stage: row.stage,
    createdAt: row.createdAt.toISOString(),
  });
}

/**
 * Persists each event with an increasing `seq` per run (resuming from the database maximum) and then publishes
 * it. Writes are chained so concurrent emits keep their order.
 */
export async function createEventRecorder(
  prisma: PrismaClient,
  bus: EventBus,
  runId: string,
): Promise<RunEventRecorder> {
  const last = await prisma.runEvent.aggregate({ where: { runId }, _max: { seq: true } });
  let seq = last._max.seq ?? 0;
  let chain: Promise<unknown> = Promise.resolve();
  return {
    emit(input) {
      const next = chain.then(async () => {
        const { type, runId: _runId, stage, ...data } = input;
        const row = await prisma.runEvent.create({
          data: { runId, seq: seq + 1, type, stage, data: data as Prisma.InputJsonValue },
        });
        seq = row.seq;
        const event = rowToEvent(row);
        bus.publish(event);
        return event;
      });
      chain = next.catch(() => {});
      return next;
    },
  };
}

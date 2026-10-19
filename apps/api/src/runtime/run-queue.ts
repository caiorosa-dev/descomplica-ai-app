import { PipelineError } from '@app/pipeline';
import PQueue from 'p-queue';
import type { Logger } from './pipeline-runner';

export interface RunQueue {
  enqueue(runId: string): void;
  /** Aborts a queued or running run; false when the queue does not know it. */
  cancel(runId: string): boolean;
  onIdle(): Promise<void>;
  /**
   * Stops for an API shutdown: queued runs are dropped (they stay `queued` and are marked interrupted on the
   * next start) and running ones are aborted as INTERRUPTED, not cancelled; waits for them to settle.
   */
  shutdown(): Promise<void>;
}

/** In-process queue (p-queue) with `RUN_CONCURRENCY` runs at a time and one AbortController per run. */
export function createRunQueue(deps: {
  concurrency: number;
  execute: (runId: string, signal: AbortSignal) => Promise<void>;
  log?: Logger;
}): RunQueue {
  const queue = new PQueue({ concurrency: deps.concurrency });
  const controllers = new Map<string, AbortController>();
  return {
    enqueue(runId) {
      const controller = new AbortController();
      controllers.set(runId, controller);
      queue
        .add(async () => {
          try {
            await deps.execute(runId, controller.signal);
          } finally {
            controllers.delete(runId);
          }
        })
        // A failure outside the stage loop must not become an unhandled rejection (fatal in Node).
        .catch((err) => deps.log?.error({ err, runId }, 'run task failed'));
    },
    cancel(runId) {
      const controller = controllers.get(runId);
      if (!controller) return false;
      controller.abort();
      return true;
    },
    onIdle: () => queue.onIdle(),
    async shutdown() {
      queue.pause();
      queue.clear();
      const reason = new PipelineError('INTERRUPTED', 'API shutting down');
      for (const c of controllers.values()) c.abort(reason);
      await queue.onIdle();
    },
  };
}

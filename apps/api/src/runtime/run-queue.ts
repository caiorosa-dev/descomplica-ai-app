import PQueue from 'p-queue';

export interface RunQueue {
  enqueue(runId: string): void;
  /** Aborts a queued or running run; false when the queue does not know it. */
  cancel(runId: string): boolean;
  onIdle(): Promise<void>;
  /** Aborts everything and waits for in-flight runs to settle. */
  shutdown(): Promise<void>;
}

/** In-process queue (p-queue) with `RUN_CONCURRENCY` runs at a time and one AbortController per run. */
export function createRunQueue(deps: {
  concurrency: number;
  execute: (runId: string, signal: AbortSignal) => Promise<void>;
}): RunQueue {
  const queue = new PQueue({ concurrency: deps.concurrency });
  const controllers = new Map<string, AbortController>();
  return {
    enqueue(runId) {
      const controller = new AbortController();
      controllers.set(runId, controller);
      void queue.add(async () => {
        try {
          await deps.execute(runId, controller.signal);
        } finally {
          controllers.delete(runId);
        }
      });
    },
    cancel(runId) {
      const controller = controllers.get(runId);
      if (!controller) return false;
      controller.abort();
      return true;
    },
    onIdle: () => queue.onIdle(),
    async shutdown() {
      for (const c of controllers.values()) c.abort();
      await queue.onIdle();
    },
  };
}

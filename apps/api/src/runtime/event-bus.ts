import { EventEmitter } from 'node:events';
import type { RunEvent } from '@app/shared';

export interface EventBus {
  publish(event: RunEvent): void;
  subscribe(runId: string, listener: (event: RunEvent) => void): () => void;
}

/** In-process pub/sub of run events, keyed by run id. */
export function createEventBus(): EventBus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  return {
    publish: (event) => emitter.emit(event.runId, event),
    subscribe(runId, listener) {
      emitter.on(runId, listener);
      return () => emitter.off(runId, listener);
    },
  };
}

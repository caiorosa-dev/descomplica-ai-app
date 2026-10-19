import { type RunDto, RunEvent, TERMINAL_RUN_STATUSES } from '@app/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { applyRunEvent, initialLiveState, type RunLiveState } from './events-reducer';

const EVENT_TYPES = RunEvent.options.map((o) => o.shape.type.value);

/**
 * Follows a run over SSE: each event goes through the pure reducer into the ['run', id, 'live'] cache; the
 * terminal run.status refreshes the run and its result and closes the stream.
 */
export function useRunEvents(runId: string, run: RunDto | undefined): RunLiveState | null {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RunLiveState | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const ready = Boolean(run);

  useEffect(() => {
    const initialRun = runRef.current;
    if (!ready || !initialRun) return;
    const key = ['run', runId, 'live'];
    let current = queryClient.getQueryData<RunLiveState>(key) ?? initialLiveState(initialRun);
    queryClient.setQueryData(key, current);
    setState(current);

    const source = new EventSource(`/api/runs/${runId}/events?lastEventId=${current.lastSeq}`);
    const isTerminal = (status: string) => TERMINAL_RUN_STATUSES.includes(status as RunDto['status']);
    const onMessage = (message: MessageEvent<string>) => {
      const parsed = RunEvent.safeParse(JSON.parse(message.data));
      if (!parsed.success) return;
      current = applyRunEvent(current, parsed.data);
      queryClient.setQueryData(key, current);
      setState(current);
      if (parsed.data.type === 'run.status' && isTerminal(parsed.data.status)) {
        source.close();
        void queryClient.invalidateQueries({ queryKey: ['run', runId], exact: true });
        void queryClient.invalidateQueries({ queryKey: ['run', runId, 'result'] });
        void queryClient.invalidateQueries({ queryKey: ['documents'] });
      }
    };
    for (const type of EVENT_TYPES) source.addEventListener(type, onMessage as EventListener);
    // The server closes the stream of a finished run; without this the browser would keep reconnecting.
    source.onerror = () => {
      if (isTerminal(current.status) || isTerminal(runRef.current?.status ?? '')) source.close();
    };
    return () => source.close();
  }, [runId, ready, queryClient]);

  return state;
}

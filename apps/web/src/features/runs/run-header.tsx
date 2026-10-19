import { type RunDto, TERMINAL_RUN_STATUSES } from '@app/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { RunStatusBadge } from '@/components/tone-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatUsd } from '@/lib/format';
import { usePresets } from '../documents/queries';
import type { RunLiveState } from './events-reducer';
import { useDocument } from './queries';

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function RunHeader({ run, live, actions }: { run: RunDto; live: RunLiveState | null; actions?: ReactNode }) {
  const document = useDocument(run.documentId);
  const presets = usePresets();
  const status = live?.status ?? run.status;
  const running = !TERMINAL_RUN_STATUSES.includes(status);
  const now = useNow(running);
  const started = run.startedAt ? new Date(run.startedAt).getTime() : null;
  const finished = run.finishedAt ? new Date(run.finishedAt).getTime() : null;
  const duration = started ? (finished ?? now) - started : null;
  const liveCost = live?.llmCalls.reduce((sum, c) => sum + c.costUsd, 0) ?? 0;
  const preset = presets.data?.find((p) => p.id === run.presetId);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {document.data ? (
          <h1 className="truncate font-heading text-2xl font-semibold" title={document.data.filename}>
            {document.data.filename}
          </h1>
        ) : (
          <Skeleton className="h-8 w-64" />
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <RunStatusBadge status={status} />
          <span>{preset ? preset.name : 'Preset removido'}</span>
          {run.label && <span>· {run.label}</span>}
          {run.parentRunId && <span>· reprocessamento</span>}
          <span className="tabular-nums">· {formatUsd(Math.max(run.totals.costUsd, liveCost))}</span>
          <span className="tabular-nums">· {formatDuration(duration)}</span>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

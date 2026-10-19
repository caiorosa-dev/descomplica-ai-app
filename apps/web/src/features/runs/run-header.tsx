import { type RunDto, TERMINAL_RUN_STATUSES } from '@app/shared';
import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon, CircleDollarSignIcon, ClockIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { RunStatusBadge, ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
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
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link to="/">
          <ArrowLeftIcon data-icon="inline-start" />
          Documentos
        </Link>
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2.5">
          {document.data ? (
            <h1 className="truncate text-3xl font-semibold" title={document.data.filename}>
              {document.data.filename}
            </h1>
          ) : (
            <Skeleton className="h-9 w-72" />
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <RunStatusBadge status={status} />
            <ToneBadge tone="neutral">{preset ? preset.name : 'Preset removido'}</ToneBadge>
            {run.parentRunId && <ToneBadge tone="violet">Refeito</ToneBadge>}
            {run.label && <ToneBadge tone="neutral">{run.label}</ToneBadge>}
            <span className="flex items-center gap-1 tabular-nums">
              <CircleDollarSignIcon aria-hidden className="size-3.5" />
              {formatUsd(Math.max(run.totals.costUsd, liveCost))}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <ClockIcon aria-hidden className="size-3.5" />
              {formatDuration(duration)}
            </span>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

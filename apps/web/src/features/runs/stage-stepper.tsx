import { STAGE_ORDER, type StageName, type StageRunStatus } from '@app/shared';
import { CheckIcon, PencilLineIcon, RecycleIcon, XIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { formatDuration, formatNumber, formatUsd } from '@/lib/format';
import { STAGE_LABELS, STAGE_RUN_STATUS_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { LiveStage } from './events-reducer';

const NODE: Record<StageRunStatus, string> = {
  pending: 'border border-border bg-card text-muted-foreground',
  running: 'bg-info-soft text-info ring-4 ring-info-soft',
  completed: 'bg-primary text-primary-foreground',
  reused: 'bg-info-soft text-info',
  overridden: 'bg-violet-soft text-violet',
  failed: 'bg-destructive text-white',
};

interface StageUsage {
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

function usageOf(metrics: unknown): StageUsage {
  return metrics && typeof metrics === 'object' ? (metrics as StageUsage) : {};
}

function NodeIcon({ status, index }: { status: StageRunStatus; index: number }) {
  if (status === 'completed') return <CheckIcon className="size-3.5" strokeWidth={3} />;
  if (status === 'running') return <Spinner className="size-3.5" />;
  if (status === 'failed') return <XIcon className="size-3.5" strokeWidth={3} />;
  if (status === 'reused') return <RecycleIcon className="size-3.5" />;
  if (status === 'overridden') return <PencilLineIcon className="size-3.5" />;
  return <span className="text-xs font-semibold tabular-nums">{index + 1}</span>;
}

export function StageStepper({ stages }: { stages: Record<StageName, LiveStage> }) {
  return (
    <ol className="flex flex-col" aria-label="Etapas">
      {STAGE_ORDER.map((name, i) => {
        const stage = stages[name];
        const usage = usageOf(stage.metrics);
        const tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
        const isLast = i === STAGE_ORDER.length - 1;
        const done = stage.status === 'completed' || stage.status === 'reused' || stage.status === 'overridden';
        return (
          <li key={name} className="flex gap-3" aria-current={stage.status === 'running' ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', NODE[stage.status])}
                aria-hidden
              >
                <NodeIcon status={stage.status} index={i} />
              </span>
              {!isLast && (
                <span className={cn('my-1 w-0.5 flex-1 rounded-full', done ? 'bg-primary/40' : 'bg-border')} />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5 pb-5">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('font-medium', stage.status === 'pending' && 'text-muted-foreground')}>
                  {STAGE_LABELS[name]}
                </span>
                {stage.status !== 'pending' && (
                  <span className="text-xs text-muted-foreground">{STAGE_RUN_STATUS_LABELS[stage.status]}</span>
                )}
              </div>
              {stage.status === 'running' && stage.lastMessage && (
                <p className="text-sm text-muted-foreground">{stage.lastMessage}</p>
              )}
              {stage.status === 'running' && stage.total ? (
                <Progress
                  value={((stage.current ?? 0) / stage.total) * 100}
                  aria-label={`Progresso de ${STAGE_LABELS[name]}`}
                  className="h-1.5"
                />
              ) : null}
              {(stage.durationMs !== null || tokens > 0) && (
                <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
                  <span>{formatDuration(stage.durationMs)}</span>
                  {tokens > 0 && <span>{formatNumber(tokens)} tokens</span>}
                  {usage.costUsd ? <span>{formatUsd(usage.costUsd)}</span> : null}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

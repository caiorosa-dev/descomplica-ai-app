import { STAGE_ORDER, type StageName, type StageRunStatus } from '@app/shared';
import {
  CheckCircle2Icon,
  CircleIcon,
  Loader2Icon,
  type LucideIcon,
  PencilLineIcon,
  RecycleIcon,
  XCircleIcon,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatDuration, formatNumber, formatUsd } from '@/lib/format';
import { STAGE_LABELS, STAGE_RUN_STATUS_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { LiveStage } from './events-reducer';

const ICONS: Record<StageRunStatus, { icon: LucideIcon; className: string }> = {
  pending: { icon: CircleIcon, className: 'text-muted-foreground' },
  running: { icon: Loader2Icon, className: 'animate-spin text-info' },
  completed: { icon: CheckCircle2Icon, className: 'text-success' },
  reused: { icon: RecycleIcon, className: 'text-muted-foreground' },
  overridden: { icon: PencilLineIcon, className: 'text-muted-foreground' },
  failed: { icon: XCircleIcon, className: 'text-destructive' },
};

interface StageUsage {
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

function usageOf(metrics: unknown): StageUsage {
  return metrics && typeof metrics === 'object' ? (metrics as StageUsage) : {};
}

export function StageStepper({ stages }: { stages: Record<StageName, LiveStage> }) {
  return (
    <ol className="flex flex-col gap-1" aria-label="Etapas da execução">
      {STAGE_ORDER.map((name, i) => {
        const stage = stages[name];
        const { icon: Icon, className } = ICONS[stage.status];
        const usage = usageOf(stage.metrics);
        const tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
        const isLast = i === STAGE_ORDER.length - 1;
        return (
          <li key={name} className="flex gap-3" aria-current={stage.status === 'running' ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <Icon className={cn('mt-0.5 size-5 shrink-0', className)} aria-hidden />
              {!isLast && <div className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pb-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{STAGE_LABELS[name]}</span>
                <span className="text-xs text-muted-foreground">{STAGE_RUN_STATUS_LABELS[stage.status]}</span>
              </div>
              {stage.lastMessage && <p className="text-sm text-muted-foreground">{stage.lastMessage}</p>}
              {stage.status === 'running' && stage.total ? (
                <Progress
                  value={((stage.current ?? 0) / stage.total) * 100}
                  aria-label={`Progresso de ${STAGE_LABELS[name]}`}
                />
              ) : null}
              {(stage.durationMs !== null || tokens > 0) && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(stage.durationMs)}
                  {tokens > 0 && ` · ${formatNumber(tokens)} tokens`}
                  {usage.costUsd ? ` · ${formatUsd(usage.costUsd)}` : ''}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

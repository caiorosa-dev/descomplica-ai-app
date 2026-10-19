import type { RunStatus } from '@app/shared';
import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { RUN_STATUS_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  neutral: '',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  info: 'border-info/30 bg-info/10 text-info',
};

/** Color is reserved for status and severity (spec §9); everything else stays neutral. */
export function ToneBadge({ tone, className, ...props }: ComponentProps<typeof Badge> & { tone: Tone }) {
  return (
    <Badge
      variant={tone === 'neutral' ? 'secondary' : 'outline'}
      className={cn(TONE_CLASS[tone], className)}
      {...props}
    />
  );
}

export const RUN_STATUS_TONE: Record<RunStatus, Tone> = {
  queued: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'warning',
  interrupted: 'warning',
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <ToneBadge tone={RUN_STATUS_TONE[status]}>{RUN_STATUS_LABELS[status]}</ToneBadge>;
}

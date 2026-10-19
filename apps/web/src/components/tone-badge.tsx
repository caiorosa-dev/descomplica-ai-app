import type { DocumentType, RunStatus } from '@app/shared';
import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { DOCUMENT_TYPE_LABELS, RUN_STATUS_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'teal';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-neutral-tone',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
  info: 'bg-info-soft text-info',
  violet: 'bg-violet-soft text-violet',
  teal: 'bg-teal-soft text-teal',
};

/** Soft-filled badge: strong text on a pale fill of the same hue. */
export function ToneBadge({ tone, className, ...props }: ComponentProps<typeof Badge> & { tone: Tone }) {
  return <Badge variant="secondary" className={cn(TONE_CLASS[tone], className)} {...props} />;
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
  return (
    <ToneBadge tone={RUN_STATUS_TONE[status]}>
      {status === 'running' && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
      {RUN_STATUS_LABELS[status]}
    </ToneBadge>
  );
}

export const DOCUMENT_TYPE_TONE: Record<DocumentType, Tone> = {
  court_decision: 'info',
  normative_act: 'violet',
  generic: 'neutral',
};

export function DocumentTypeBadge({ type }: { type: DocumentType }) {
  return <ToneBadge tone={DOCUMENT_TYPE_TONE[type]}>{DOCUMENT_TYPE_LABELS[type]}</ToneBadge>;
}

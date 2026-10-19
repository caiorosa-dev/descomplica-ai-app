import type { Alert, Summary } from '@app/shared';
import { EyeIcon } from 'lucide-react';
import { type Tone, ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { ALERT_TYPE_LABELS, CATEGORY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useSourceSheet } from './use-source-sheet';

export const SEVERITY_TONE: Record<Alert['severity'], Tone> = { high: 'danger', medium: 'warning', low: 'info' };
const BAR: Record<Alert['severity'], string> = { high: 'bg-destructive', medium: 'bg-warning', low: 'bg-info' };

export function AlertItem({
  alert,
  canonicalText,
  summary,
}: {
  alert: Alert;
  canonicalText: string | undefined;
  summary: Summary | undefined;
}) {
  const sheet = useSourceSheet();
  const paragraph = alert.summaryRef
    ? summary?.sections[alert.summaryRef.sectionIndex]?.paragraphs[alert.summaryRef.paragraphIndex]?.text
    : undefined;
  return (
    <article className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-card p-5 pl-7 ring-1 ring-border">
      <span className={cn('absolute inset-y-4 left-3 w-1 rounded-full', BAR[alert.severity])} aria-hidden />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToneBadge tone={SEVERITY_TONE[alert.severity]}>{ALERT_TYPE_LABELS[alert.type]}</ToneBadge>
          {alert.category && <ToneBadge tone="neutral">{CATEGORY_LABELS[alert.category]}</ToneBadge>}
        </div>
        <h4 className="text-base font-semibold">{alert.title}</h4>
        <p className="text-sm text-muted-foreground">{alert.explanation}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">No documento</p>
          {alert.sourceEvidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum trecho encontrado.</p>
          ) : (
            alert.sourceEvidence.map((span) => (
              <div key={`${span.start}-${span.end}`} className="flex flex-col items-start gap-1">
                <blockquote className="text-sm">
                  {canonicalText ? `“${canonicalText.slice(span.start, span.end)}”` : '…'}
                </blockquote>
                <Button variant="ghost" size="sm" className="-ml-2" onClick={() => sheet.open(span)}>
                  <EyeIcon data-icon="inline-start" />
                  Ver trecho
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">No resumo</p>
          <blockquote className="text-sm">{paragraph ? `“${paragraph}”` : 'O resumo não fala disso.'}</blockquote>
        </div>
      </div>
    </article>
  );
}

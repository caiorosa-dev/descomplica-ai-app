import type { Alert, Summary } from '@app/shared';
import { EyeIcon } from 'lucide-react';
import { type Tone, ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ALERT_TYPE_LABELS, CATEGORY_LABELS, SEVERITY_LABELS } from '@/lib/labels';
import { useSourceSheet } from './use-source-sheet';

export const SEVERITY_TONE: Record<Alert['severity'], Tone> = { high: 'danger', medium: 'warning', low: 'info' };

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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={SEVERITY_TONE[alert.severity]}>
            Severidade {SEVERITY_LABELS[alert.severity].toLowerCase()}
          </ToneBadge>
          <ToneBadge tone="neutral">{ALERT_TYPE_LABELS[alert.type]}</ToneBadge>
          {alert.category && <ToneBadge tone="neutral">{CATEGORY_LABELS[alert.category]}</ToneBadge>}
        </div>
        <CardTitle>{alert.title}</CardTitle>
        <CardDescription>{alert.explanation}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">O documento diz</p>
          {alert.sourceEvidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum trecho ancorado.</p>
          ) : (
            alert.sourceEvidence.map((span) => (
              <div key={`${span.start}-${span.end}`} className="flex flex-col items-start gap-1">
                <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">
                  {canonicalText ? `“${canonicalText.slice(span.start, span.end)}”` : '…'}
                </blockquote>
                <Button variant="ghost" size="sm" onClick={() => sheet.open(span)}>
                  <EyeIcon data-icon="inline-start" />
                  Ver trecho
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">O resumo diz</p>
          <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">
            {paragraph ? `“${paragraph}”` : 'O resumo não trata deste ponto.'}
          </blockquote>
        </div>
      </CardContent>
    </Card>
  );
}

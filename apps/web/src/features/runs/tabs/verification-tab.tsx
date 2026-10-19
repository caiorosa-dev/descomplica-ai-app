import type { RunResultDto, RunTextDto, Severity } from '@app/shared';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { formatPercent, formatScore } from '@/lib/format';
import { SEVERITY_LABELS, VERDICT_LABELS } from '@/lib/labels';
import { AlertItem } from '../alert-item';
import { MetricCard } from '../metric-card';

const HEADLINE_LABELS = {
  centroid: 'Centroide',
  coverage: 'Cobertura',
  support: 'Respaldo',
  alignment_f1: 'Alinhamento (F1)',
} as const;
const SEVERITIES: Severity[] = ['high', 'medium', 'low'];

export function VerificationTab({ result, text }: { result: RunResultDto; text: RunTextDto | undefined }) {
  const facts = new Map(result.facts.map((f) => [f.id, f]));
  const alerted = new Set(result.alerts.map((a) => a.verificationItemId));
  const notIncluded = result.items.filter(
    (i) =>
      i.direction === 'source_to_summary' &&
      (i.verdict === 'omitted' || i.verdict === 'unverifiable') &&
      !alerted.has(i.id),
  );
  const metrics = result.metrics;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`Similaridade semântica · ${result.similarity ? HEADLINE_LABELS[result.similarity.headline.metric] : ''}`}
          value={formatScore(result.similarity?.headline.value ?? null)}
          info="Similaridade mede proximidade de assunto, não exatidão dos fatos. Confira os alertas abaixo."
        />
        <MetricCard
          label="Consistência factual"
          value={formatPercent(metrics?.factualConsistency ?? null)}
          hint="Fatos críticos do documento que o resumo traz corretamente."
        />
        <MetricCard
          label="Respaldo das afirmações"
          value={formatPercent(metrics?.claimSupport ?? null)}
          hint="Afirmações do resumo confirmadas no documento."
        />
        <MetricCard
          label="Não verificáveis"
          value={metrics?.unverifiableCount ?? 0}
          hint="Itens sem evidência suficiente para decidir."
        />
      </div>

      {result.alerts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhum alerta</EmptyTitle>
            <EmptyDescription>
              A verificação não encontrou divergências, omissões críticas nem afirmações sem respaldo.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        SEVERITIES.map((severity) => {
          const alerts = result.alerts.filter((a) => a.severity === severity);
          if (alerts.length === 0) return null;
          return (
            <section key={severity} className="flex flex-col gap-3">
              <h3 className="font-heading font-semibold">
                Severidade {SEVERITY_LABELS[severity].toLowerCase()} ({alerts.length})
              </h3>
              {alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  canonicalText={text?.canonicalText}
                  summary={result.summary?.summary}
                />
              ))}
            </section>
          );
        })
      )}

      <Collapsible>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-fit">
                <ChevronDownIcon data-icon="inline-start" />
                Não incluídos no resumo ({notIncluded.length})
              </Button>
            </CollapsibleTrigger>
            <CardTitle className="sr-only">Não incluídos no resumo</CardTitle>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="flex flex-col gap-2">
              {notIncluded.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item.</p>
              ) : (
                notIncluded.map((item) => {
                  const fact = item.factId ? facts.get(item.factId) : undefined;
                  return (
                    <div key={item.id} className="flex flex-col text-sm">
                      <span className="font-medium">
                        {fact?.label ?? item.factId} · {VERDICT_LABELS[item.verdict]}
                      </span>
                      <span className="text-muted-foreground">{item.explanation}</span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

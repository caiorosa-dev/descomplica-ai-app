import type { RunResultDto, RunTextDto, Severity } from '@app/shared';
import { CheckIcon, ChevronDownIcon, InfoIcon } from 'lucide-react';
import { ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercent, formatScore } from '@/lib/format';
import { SEVERITY_LABELS, VERDICT_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { AlertItem } from '../alert-item';

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
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-border ring-1 ring-border md:grid-cols-4">
        <Score
          label="Dados corretos"
          value={formatPercent(metrics?.factualConsistency ?? null)}
          info="Dados importantes do documento que o resumo traz certo."
        />
        <Score
          label="Frases com apoio"
          value={formatPercent(metrics?.claimSupport ?? null)}
          info="Frases do resumo que o documento confirma."
        />
        <Score
          label="Sem como conferir"
          value={String(metrics?.unverifiableCount ?? 0)}
          info="Itens sem trecho suficiente no documento para decidir."
        />
        <Score
          label="Parecido com o original"
          value={formatScore(result.similarity?.headline.value ?? null)}
          info={`Mede se o assunto é o mesmo, não se os dados estão certos. Métrica: ${
            result.similarity ? HEADLINE_LABELS[result.similarity.headline.metric] : 'nenhuma'
          }.`}
          muted
        />
      </div>

      {result.alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckIcon aria-hidden strokeWidth={2.5} />
          </span>
          <p className="font-heading text-lg font-semibold">Nenhum alerta</p>
          <p className="text-sm text-muted-foreground">Os dados do resumo batem com o documento.</p>
        </div>
      ) : (
        SEVERITIES.map((severity) => {
          const alerts = result.alerts.filter((a) => a.severity === severity);
          if (alerts.length === 0) return null;
          return (
            <section key={severity} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 font-semibold">
                <span className={cn('size-2.5 rounded-full', SEVERITY_DOT[severity])} aria-hidden />
                Prioridade {SEVERITY_LABELS[severity].toLowerCase()}
                <span className="text-muted-foreground tabular-nums">{alerts.length}</span>
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

      <Collapsible className="flex flex-col gap-3">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="group w-fit -ml-3 text-muted-foreground">
            <ChevronDownIcon
              data-icon="inline-start"
              className="transition-transform group-data-[state=open]:rotate-180"
            />
            Ficou de fora do resumo
            <span className="tabular-nums">{notIncluded.length}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-2 overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          {notIncluded.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada ficou de fora.</p>
          ) : (
            notIncluded.map((item) => {
              const fact = item.factId ? facts.get(item.factId) : undefined;
              return (
                <div key={item.id} className="flex flex-col gap-1 rounded-2xl bg-card p-4 text-sm ring-1 ring-border">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {fact?.label ?? item.factId}
                    <ToneBadge tone="neutral">{VERDICT_LABELS[item.verdict]}</ToneBadge>
                  </span>
                  <span className="text-muted-foreground">{item.explanation}</span>
                </div>
              );
            })
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const SEVERITY_DOT: Record<Severity, string> = { high: 'bg-destructive', medium: 'bg-warning-vivid', low: 'bg-info' };

function Score({ label, value, info, muted }: { label: string; value: string; info: string; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-5">
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label={`Sobre ${label}`} className="rounded-full">
              <InfoIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{info}</TooltipContent>
        </Tooltip>
      </span>
      <span className={cn('font-heading text-3xl font-semibold tabular-nums', muted && 'text-muted-foreground')}>
        {value}
      </span>
    </div>
  );
}

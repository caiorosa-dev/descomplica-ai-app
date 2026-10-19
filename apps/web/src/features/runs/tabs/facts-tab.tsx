import { type Fact, FactCategory, type RunResultDto } from '@app/shared';
import {
  BanknoteIcon,
  BookOpenIcon,
  CalendarIcon,
  EyeIcon,
  GavelIcon,
  HourglassIcon,
  ListChecksIcon,
  type LucideIcon,
  PenLineIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Segmented } from '@/components/segmented';
import { ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, FACT_STATUS_LABELS, UNCERTAINTY_REASON_LABELS } from '@/lib/labels';
import { FactValue } from '../fact-value';
import { useSourceSheet } from '../use-source-sheet';

type StatusFilter = 'all' | 'confirmed' | 'uncertain';

const CATEGORY_ICON: Record<FactCategory, LucideIcon> = {
  date: CalendarIcon,
  deadline: HourglassIcon,
  monetary_value: BanknoteIcon,
  obligation: ListChecksIcon,
  decision: GavelIcon,
  legal_reference: BookOpenIcon,
  amendment: PenLineIcon,
};

function firstAnchored(fact: Fact) {
  return fact.evidence.find((e) => e.start !== null && e.end !== null);
}

function StatusBadge({ fact }: { fact: Fact }) {
  const badge = (
    <ToneBadge tone={fact.status === 'confirmed' ? 'success' : 'warning'}>{FACT_STATUS_LABELS[fact.status]}</ToneBadge>
  );
  if (fact.status === 'confirmed') return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="rounded-full">
          {badge}
        </button>
      </TooltipTrigger>
      <TooltipContent>{fact.uncertaintyReasons.map((r) => UNCERTAINTY_REASON_LABELS[r]).join('. ')}</TooltipContent>
    </Tooltip>
  );
}

function FactRow({ fact, sectionLabel }: { fact: Fact; sectionLabel: string | undefined }) {
  const sheet = useSourceSheet();
  const anchor = firstAnchored(fact);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-card p-4 ring-1 ring-border"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm text-muted-foreground">{fact.label}</span>
        <span className="font-heading text-lg font-semibold">
          <FactValue fact={fact} />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusBadge fact={fact} />
          <ToneBadge tone="neutral">Confiança {CONFIDENCE_LABELS[fact.confidence].toLowerCase()}</ToneBadge>
          {sectionLabel && <ToneBadge tone="neutral">{sectionLabel}</ToneBadge>}
          <span className="text-xs text-muted-foreground">{fact.id}</span>
        </span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="rounded-full"
        disabled={!anchor}
        onClick={() =>
          anchor && sheet.open({ start: anchor.start as number, end: anchor.end as number, page: anchor.page })
        }
      >
        <EyeIcon data-icon="inline-start" />
        Ver trecho
      </Button>
    </motion.li>
  );
}

export function FactsTab({ result }: { result: RunResultDto }) {
  const [category, setCategory] = useState<'all' | FactCategory>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const sections = new Map(result.sections.map((s) => [s.id, s]));
  const present = FactCategory.options.filter((c) => result.facts.some((f) => f.category === c));
  const visible = result.facts.filter(
    (f) => (category === 'all' || f.category === category) && (status === 'all' || f.status === status),
  );
  const groups = FactCategory.options
    .map((c) => ({ category: c, facts: visible.filter((f) => f.category === c) }))
    .filter((g) => g.facts.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          variant="chips"
          value={category}
          onChange={setCategory}
          layoutId="fact-category"
          aria-label="Tipo de dado"
          options={[{ value: 'all', label: 'Todos' }, ...present.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))]}
        />
        <Segmented
          value={status}
          onChange={setStatus}
          layoutId="fact-status"
          aria-label="Situação"
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'confirmed', label: 'Confirmados' },
            { value: 'uncertain', label: 'Incertos' },
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum dado com esse filtro.
        </p>
      ) : (
        groups.map((g) => {
          const Icon = CATEGORY_ICON[g.category];
          return (
            <section key={g.category} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon aria-hidden className="size-4" />
                </span>
                {CATEGORY_LABELS[g.category]}
              </h3>
              <ul className="flex flex-col gap-2">
                {g.facts.map((fact) => {
                  const sectionId = firstAnchored(fact)?.sectionId;
                  return (
                    <FactRow
                      key={fact.id}
                      fact={fact}
                      sectionLabel={sectionId ? sections.get(sectionId)?.label : undefined}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {result.notFound.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Não aparece no documento:
          {result.notFound.map((c) => (
            <ToneBadge key={c} tone="neutral">
              {CATEGORY_LABELS[c]}
            </ToneBadge>
          ))}
        </p>
      )}

      {result.ambiguities.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">Pontos com dúvida</h3>
          {result.ambiguities.map((a) => (
            <div key={a.quote} className="flex flex-col gap-1 rounded-2xl bg-warning-soft p-4 text-sm">
              <span>{a.description}</span>
              <blockquote className="text-muted-foreground">“{a.quote}”</blockquote>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

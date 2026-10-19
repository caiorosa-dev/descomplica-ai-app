import type { RunResultDto, RunTextDto, Severity } from '@app/shared';
import { ToneBadge } from '@/components/tone-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatNumber } from '@/lib/format';
import { SEVERITY_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { FactValue } from '../fact-value';

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEVERITY_UNDERLINE: Record<Severity, string> = {
  high: 'underline decoration-destructive decoration-2 underline-offset-4',
  medium: 'underline decoration-warning decoration-2 underline-offset-4',
  low: 'underline decoration-info decoration-2 underline-offset-4',
};

export function SummaryTab({ result, text }: { result: RunResultDto; text: RunTextDto | undefined }) {
  const output = result.summary;
  if (!output) return <p className="text-muted-foreground">O resumo ainda não foi gerado.</p>;
  const { summary, readability, compressionRatio } = output;
  const facts = new Map(result.facts.map((f) => [f.id, f]));
  const alertAt = new Map<string, Severity>();
  for (const a of result.alerts) {
    if (!a.summaryRef) continue;
    const key = `${a.summaryRef.sectionIndex}:${a.summaryRef.paragraphIndex}`;
    const current = alertAt.get(key);
    if (!current || SEVERITY_RANK[a.severity] < SEVERITY_RANK[current]) alertAt.set(key, a.severity);
  }
  // Summary chunks are numbered P01, P02... in section order (P00 is the overview).
  const lowSupport = new Set((text?.supportByParagraph ?? []).filter((p) => p.highlighted).map((p) => p.chunkId));
  let chunk = 0;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h2 className="max-w-[28ch] text-3xl font-semibold text-balance">{summary.title}</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Stat
            label="Leitura"
            value={`${formatOne(readability.source)} → ${formatOne(readability.summary)}`}
            hint="Índice Flesch do original e do resumo. Quanto maior, mais fácil de ler."
          />
          <Stat
            label="Tamanho"
            value={
              compressionRatio >= 1
                ? `${formatOne(compressionRatio)}x menor`
                : `${formatOne(1 / compressionRatio)}x maior`
            }
            hint="Palavras do original divididas pelas palavras do resumo."
          />
          <Stat label="Dados" value={formatNumber(result.facts.length)} hint="Dados extraídos que apoiam o resumo." />
        </div>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex max-w-[68ch] flex-col gap-8">
          <p
            className={cn(
              'rounded-3xl bg-secondary p-6 text-lg leading-relaxed text-secondary-foreground',
              lowSupport.has('P00') && 'underline decoration-dotted underline-offset-4',
            )}
          >
            {summary.overview}
          </p>
          {summary.sections.map((section, si) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h3 className="text-xl font-semibold">{section.heading}</h3>
              {section.paragraphs.map((p, pi) => {
                chunk++;
                const severity = alertAt.get(`${si}:${pi}`);
                const weak = lowSupport.has(`P${String(chunk).padStart(2, '0')}`);
                const body = (
                  <span
                    className={cn(
                      severity
                        ? SEVERITY_UNDERLINE[severity]
                        : weak && 'underline decoration-dotted decoration-muted-foreground underline-offset-4',
                    )}
                  >
                    {p.text}
                  </span>
                );
                return (
                  <div key={p.text} className="flex flex-col gap-2">
                    <p className="leading-relaxed text-foreground/90">
                      {severity ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{body}</TooltipTrigger>
                          <TooltipContent>
                            Alerta de prioridade {SEVERITY_LABELS[severity].toLowerCase()}
                          </TooltipContent>
                        </Tooltip>
                      ) : weak ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{body}</TooltipTrigger>
                          <TooltipContent>Pouco apoio no texto original</TooltipContent>
                        </Tooltip>
                      ) : (
                        body
                      )}
                    </p>
                    {p.factRefs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.factRefs.map((id) => {
                          const fact = facts.get(id);
                          return (
                            <Tooltip key={id}>
                              <TooltipTrigger asChild>
                                <button type="button" className="rounded-full">
                                  <ToneBadge tone={fact?.status === 'uncertain' ? 'warning' : 'info'}>{id}</ToneBadge>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {fact ? (
                                  <span>
                                    {fact.label}: <FactValue fact={fact} />
                                  </span>
                                ) : (
                                  'Dado não encontrado'
                                )}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        {summary.glossary.length > 0 && (
          <aside className="h-fit rounded-3xl border bg-card p-5 lg:sticky lg:top-20">
            <h3 className="mb-3 font-semibold">Palavras difíceis</h3>
            <dl className="flex flex-col gap-4 text-sm">
              {summary.glossary.map((g) => (
                <div key={g.term} className="flex flex-col gap-1">
                  <dt className="font-medium">{g.term}</dt>
                  <dd className="text-muted-foreground">{g.explanation}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </div>
    </article>
  );
}

const formatOne = (n: number) => n.toFixed(1).replace('.', ',');

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-heading font-semibold tabular-nums">{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

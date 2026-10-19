import type { RunResultDto, RunTextDto, Severity } from '@app/shared';
import { ToneBadge } from '@/components/tone-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{summary.title}</CardTitle>
          <CardDescription>Resumo em linguagem simples, gerado a partir do documento.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="mb-1 text-sm font-medium text-muted-foreground">Em resumo</p>
            <p
              className={cn(
                'leading-relaxed',
                lowSupport.has('P00') && 'underline decoration-dotted underline-offset-4',
              )}
            >
              {summary.overview}
            </p>
          </div>
          {summary.sections.map((section, si) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h3 className="font-heading text-lg font-semibold">{section.heading}</h3>
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
                    <p className="leading-relaxed">
                      {severity ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{body}</TooltipTrigger>
                          <TooltipContent>
                            Alerta de severidade {SEVERITY_LABELS[severity].toLowerCase()} na verificação
                          </TooltipContent>
                        </Tooltip>
                      ) : weak ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{body}</TooltipTrigger>
                          <TooltipContent>Pouco respaldo semântico no documento</TooltipContent>
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
                                  <ToneBadge tone={fact?.status === 'uncertain' ? 'warning' : 'neutral'}>
                                    {id}
                                  </ToneBadge>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {fact ? (
                                  <span>
                                    {fact.label}: <FactValue fact={fact} />
                                  </span>
                                ) : (
                                  'Fato não encontrado'
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
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Legibilidade (Flesch, original → resumo)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {readability.source.toFixed(1).replace('.', ',')} → {readability.summary.toFixed(1).replace('.', ',')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Quanto maior, mais fácil de ler. A contagem de sílabas é aproximada.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Compressão</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {compressionRatio.toFixed(1).replace('.', ',')} vezes menor
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Palavras do original divididas pelas palavras do resumo.
          </CardContent>
        </Card>
      </div>
      {summary.glossary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Glossário</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              {summary.glossary.map((g, i) => (
                <div key={g.term} className="flex flex-col gap-1">
                  {i > 0 && <Separator className="mb-2" />}
                  <dt className="font-medium">{g.term}</dt>
                  <dd className="text-muted-foreground">{g.explanation}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        {formatNumber(result.facts.length)} fatos extraídos apoiam este resumo.
      </p>
    </div>
  );
}

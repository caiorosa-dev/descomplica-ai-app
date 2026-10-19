import { type Fact, FactCategory, type RunResultDto } from '@app/shared';
import { EyeIcon } from 'lucide-react';
import { useState } from 'react';
import { ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, FACT_STATUS_LABELS, UNCERTAINTY_REASON_LABELS } from '@/lib/labels';
import { FactValue } from '../fact-value';
import { useSourceSheet } from '../use-source-sheet';

type StatusFilter = 'all' | 'confirmed' | 'uncertain';

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
        <button type="button">{badge}</button>
      </TooltipTrigger>
      <TooltipContent>{fact.uncertaintyReasons.map((r) => UNCERTAINTY_REASON_LABELS[r]).join('; ')}</TooltipContent>
    </Tooltip>
  );
}

export function FactsTab({ result }: { result: RunResultDto }) {
  const sheet = useSourceSheet();
  const [category, setCategory] = useState<'all' | FactCategory>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const sections = new Map(result.sections.map((s) => [s.id, s]));
  const visible = result.facts.filter(
    (f) => (category === 'all' || f.category === category) && (status === 'all' || f.status === status),
  );
  const groups = FactCategory.options
    .map((c) => ({ category: c, facts: visible.filter((f) => f.category === c) }))
    .filter((g) => g.facts.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Field className="w-56">
          <FieldLabel htmlFor="fact-category">Categoria</FieldLabel>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger id="fact-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Todas</SelectItem>
                {FactCategory.options.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <ToggleGroup
          type="single"
          variant="outline"
          value={status}
          onValueChange={(v) => v && setStatus(v as StatusFilter)}
          aria-label="Status dos fatos"
        >
          <ToggleGroupItem value="all">Todos</ToggleGroupItem>
          <ToggleGroupItem value="confirmed">Confirmados</ToggleGroupItem>
          <ToggleGroupItem value="uncertain">Incertos</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {groups.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhum fato com esses filtros</EmptyTitle>
            <EmptyDescription>Mude a categoria ou o status para ver outros fatos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        groups.map((g) => (
          <Card key={g.category}>
            <CardHeader>
              <CardTitle>{CATEGORY_LABELS[g.category]}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rótulo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Seção</TableHead>
                    <TableHead className="text-right">Trecho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.facts.map((fact) => {
                    const anchor = firstAnchored(fact);
                    return (
                      <TableRow key={fact.id}>
                        <TableCell className="font-medium">
                          <span className="text-muted-foreground">{fact.id}</span> {fact.label}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <FactValue fact={fact} />
                        </TableCell>
                        <TableCell>{CONFIDENCE_LABELS[fact.confidence]}</TableCell>
                        <TableCell>
                          <StatusBadge fact={fact} />
                        </TableCell>
                        <TableCell>{(anchor?.sectionId && sections.get(anchor.sectionId)?.label) ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!anchor}
                            onClick={() =>
                              anchor &&
                              sheet.open({
                                start: anchor.start as number,
                                end: anchor.end as number,
                                page: anchor.page,
                              })
                            }
                          >
                            <EyeIcon data-icon="inline-start" />
                            Ver trecho
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Não encontrado no documento</CardTitle>
            <CardDescription>Categorias procuradas que o documento não traz.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {result.notFound.length ? (
              result.notFound.map((c) => (
                <ToneBadge key={c} tone="neutral">
                  {CATEGORY_LABELS[c]}
                </ToneBadge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Nenhuma.</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ambiguidades</CardTitle>
            <CardDescription>Pontos em que o modelo ficou em dúvida.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {result.ambiguities.length ? (
              result.ambiguities.map((a) => (
                <div key={a.quote} className="flex flex-col gap-1 text-sm">
                  <span>{a.description}</span>
                  <blockquote className="border-l-2 pl-3 text-muted-foreground">“{a.quote}”</blockquote>
                </div>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Nenhuma.</span>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import type { RunResultDto, RunTextDto } from '@app/shared';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { buildTextSegments, coverageClass, type TextRange } from '../text-segments';

const SECTION_MARK = 'sec:';
const EVIDENCE_CLASS = 'rounded-sm bg-warning/25 ring-1 ring-warning/40';
const RULE_LABELS: Record<string, string> = {
  repeated_edge: 'Cabeçalhos e rodapés repetidos',
  page_number: 'Números de página',
  llm_cleaner: 'Limpeza por LLM',
  'boilerplate:stj-e-signature': 'Carimbo de assinatura do STJ',
  'boilerplate:dje-header': 'Cabeçalho do DJe',
};

function CanonicalText({ result, text }: { result: RunResultDto; text: RunTextDto }) {
  const [coverage, setCoverage] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => {
    const ranges: TextRange[] = [];
    for (const s of text.sections) ranges.push({ start: s.start, end: s.end, className: `${SECTION_MARK}${s.id}` });
    for (const f of result.facts)
      for (const e of f.evidence)
        if (e.start !== null && e.end !== null) ranges.push({ start: e.start, end: e.end, className: EVIDENCE_CLASS });
    if (coverage)
      for (const c of text.coverageByChunk ?? [])
        ranges.push({ start: c.start, end: c.end, className: coverageClass(c.score, c.highlighted) });
    return buildTextSegments(text.canonicalText.length, ranges);
  }, [result.facts, text, coverage]);
  const sectionStarts = new Map(text.sections.map((s) => [s.start, s.id]));

  const scrollTo = (id: string) =>
    container.current?.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  return (
    <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Seções</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[60vh]">
            <nav className="flex flex-col" aria-label="Índice de seções">
              {text.sections.map((s) => (
                <Button key={s.id} variant="ghost" size="sm" className="justify-start" onClick={() => scrollTo(s.id)}>
                  <span className="truncate">{s.parentLabel ? `${s.label} · ${s.parentLabel}` : s.label}</span>
                </Button>
              ))}
            </nav>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardDescription>Trechos que sustentam os dados aparecem destacados.</CardDescription>
          <Field orientation="horizontal" className="w-fit">
            <Switch id="coverage" checked={coverage} onCheckedChange={setCoverage} />
            <FieldLabel htmlFor="coverage">Mapa de cobertura</FieldLabel>
          </Field>
        </CardHeader>
        <CardContent>
          <div ref={container} className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
            {segments.map((seg) => {
              const sectionId = sectionStarts.get(seg.start);
              const classes = seg.classNames.filter((c) => !c.startsWith(SECTION_MARK));
              return (
                <span key={seg.start} data-section={sectionId} className={cn(classes)}>
                  {text.canonicalText.slice(seg.start, seg.end)}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CleaningReport({ text }: { text: RunTextDto }) {
  const report = text.cleaningReport;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Removido na limpeza</CardTitle>
          <CardDescription>
            {formatNumber(report.charsBefore)} caracteres lidos, {formatNumber(report.charsAfter)} depois da limpeza.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regra</TableHead>
                <TableHead className="text-right">Linhas removidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.removedByRule.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    Nenhuma linha removida.
                  </TableCell>
                </TableRow>
              ) : (
                report.removedByRule.map((r) => (
                  <TableRow key={r.rule}>
                    <TableCell>{RULE_LABELS[r.rule] ?? r.rule}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {report.removedByRule.map((r) => (
        <Card key={r.rule}>
          <CardHeader>
            <CardTitle className="text-base">{RULE_LABELS[r.rule] ?? r.rule}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {report.removed
                .filter((line) => line.rule === r.rule)
                .slice(0, 200)
                .map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static, append-only list; the same line can repeat.
                  <li key={`${line.page}-${i}-${line.text}`} className="truncate">
                    {line.page !== null && <span className="tabular-nums">p. {line.page} · </span>}
                    {line.text}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DocumentTab({ result, text }: { result: RunResultDto; text: RunTextDto | undefined }) {
  if (!text) return <Skeleton className="h-96 w-full" />;
  return (
    <Tabs defaultValue="text" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="text">Texto</TabsTrigger>
        <TabsTrigger value="removed">Removido na limpeza</TabsTrigger>
      </TabsList>
      <TabsContent value="text">
        <CanonicalText result={result} text={text} />
      </TabsContent>
      <TabsContent value="removed">
        <CleaningReport text={text} />
      </TabsContent>
    </Tabs>
  );
}

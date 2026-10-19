import type { RunDto, RunResultDto } from '@app/shared';
import { Link } from '@tanstack/react-router';
import { RunStatusBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCompression, formatDateTime, formatDuration, formatScore, formatUsd } from '@/lib/format';
import { usePresets } from '../documents/queries';
import { diffConfig } from '../runs/config-form/config-diff';
import { useRun, useRunResult } from '../runs/queries';
import { MetricsChart } from './metrics-chart';
import { parseRunsParam } from './parse-runs-param';
import { RunPicker } from './run-picker';

const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

function SummaryColumn({ title, result }: { title: string; result: RunResultDto | undefined }) {
  const summary = result?.summary?.summary;
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle>{summary?.title ?? '—'}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
        {summary ? (
          <>
            <p className="font-medium">{summary.overview}</p>
            {summary.sections.map((s) => (
              <div key={s.heading} className="flex flex-col gap-1">
                <h4 className="font-heading font-semibold">{s.heading}</h4>
                {s.paragraphs.map((p) => (
                  <p key={p.text}>{p.text}</p>
                ))}
              </div>
            ))}
          </>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </CardContent>
    </Card>
  );
}

function Comparison({ ids }: { ids: [string, string] }) {
  const runA = useRun(ids[0]);
  const runB = useRun(ids[1]);
  const resA = useRunResult(ids[0], runA.data?.status === 'completed');
  const resB = useRunResult(ids[1], runB.data?.status === 'completed');
  const presets = usePresets();
  if (!runA.data || !runB.data) return <Skeleton className="h-96 w-full" />;
  const runs: [RunDto, RunDto] = [runA.data, runB.data];
  const results = [resA.data, resB.data] as const;
  const diff = diffConfig(runs[0].config, runs[1].config);
  const presetName = (id: string | null) => presets.data?.find((p) => p.id === id)?.name ?? 'Preset removido';
  const duration = (r: RunDto) =>
    r.startedAt && r.finishedAt ? new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime() : null;
  const rows: { label: string; value: (i: 0 | 1) => string }[] = [
    {
      label: 'Legibilidade do resumo',
      value: (i) => (results[i]?.summary ? results[i].summary.readability.summary.toFixed(1).replace('.', ',') : '—'),
    },
    {
      label: 'Compressão',
      value: (i) => (results[i]?.summary ? formatCompression(results[i].summary.compressionRatio) : '—'),
    },
    { label: 'Alinhamento (F1)', value: (i) => formatScore(results[i]?.metrics?.alignmentF1 ?? null) },
    {
      label: 'Alertas altos / médios / baixos',
      value: (i) =>
        results[i]?.metrics
          ? `${results[i].metrics.alertsHigh} / ${results[i].metrics.alertsMedium} / ${results[i].metrics.alertsLow}`
          : '—',
    },
    { label: 'Custo', value: (i) => formatUsd(runs[i].totals.costUsd) },
    { label: 'Duração', value: (i) => formatDuration(duration(runs[i])) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        {runs.map((r, i) => (
          <Card key={r.id}>
            <CardHeader>
              <CardDescription>Execução {i === 0 ? 'A' : 'B'}</CardDescription>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Link to="/runs/$runId" params={{ runId: r.id }} className="hover:underline">
                  {presetName(r.presetId)}
                </Link>
                <RunStatusBadge status={r.status} />
              </CardTitle>
              <CardDescription>{formatDateTime(r.createdAt)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Diferenças de configuração</CardTitle>
          <CardDescription>
            {diff.length === 0 ? 'As duas execuções usaram a mesma configuração.' : `${diff.length} campos diferentes.`}
          </CardDescription>
        </CardHeader>
        {diff.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo</TableHead>
                  <TableHead>A</TableHead>
                  <TableHead>B</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.map((d) => (
                  <TableRow key={d.path}>
                    <TableCell className="font-mono text-xs">{d.path}</TableCell>
                    <TableCell className="whitespace-normal">{show(d.before)}</TableCell>
                    <TableCell className="whitespace-normal font-medium">{show(d.after)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Métricas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <MetricsChart a={results[0]?.metrics ?? null} b={results[1]?.metrics ?? null} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead className="text-right">A</TableHead>
                <TableHead className="text-right">B</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.value(0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.value(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryColumn title="Resumo A" result={results[0]} />
        <SummaryColumn title="Resumo B" result={results[1]} />
      </div>
    </div>
  );
}

export function ComparePage({ runs, from }: { runs?: string; from?: string }) {
  const ids = parseRunsParam(runs);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Comparar</h1>
          <p className="text-muted-foreground">Dois resultados do mesmo documento, lado a lado.</p>
        </div>
        {ids && (
          <Button asChild variant="outline">
            <Link to="/compare" search={{}}>
              Escolher outras
            </Link>
          </Button>
        )}
      </div>
      {ids ? <Comparison ids={ids} /> : <RunPicker from={from} />}
    </div>
  );
}

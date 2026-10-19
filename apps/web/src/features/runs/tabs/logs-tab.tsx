import { useState } from 'react';
import { ToneBadge } from '@/components/tone-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, formatNumber, formatUsd } from '@/lib/format';
import type { RunLiveState } from '../events-reducer';
import { LlmCallSheet } from '../llm-call-sheet';
import { useLlmCalls } from '../queries';

const LEVEL_TONE = { debug: 'neutral', info: 'neutral', warn: 'warning', error: 'danger' } as const;

export function LogsTab({ runId, live }: { runId: string; live: RunLiveState | null }) {
  const calls = useLlmCalls(runId);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Chamadas de LLM</CardTitle>
          <CardDescription>Clique numa linha para ver o prompt e a resposta completos.</CardDescription>
        </CardHeader>
        <CardContent>
          {calls.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Tentativa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Latência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(calls.data ?? []).map((c) => (
                  <TableRow
                    key={c.id}
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => setSelected(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(c.id)}
                  >
                    <TableCell className="font-medium">{c.agent}</TableCell>
                    <TableCell>{c.model}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.attempt}</TableCell>
                    <TableCell>
                      <ToneBadge tone={c.status === 'success' ? 'success' : 'danger'}>
                        {c.status === 'success' ? 'Sucesso' : 'Erro'}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(c.inputTokens + c.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(c.costUsd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.latencyMs)} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo</CardTitle>
          <CardDescription>Mensagens registradas durante a execução.</CardDescription>
        </CardHeader>
        <CardContent>
          {!live || live.logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {live.logs.map((log, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: append-only log; entries can share a timestamp.
                <li key={`${log.createdAt}-${i}`} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(log.createdAt)}
                  </span>
                  <ToneBadge tone={LEVEL_TONE[log.level as keyof typeof LEVEL_TONE] ?? 'neutral'}>
                    {log.level}
                  </ToneBadge>
                  <span>{log.message}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <LlmCallSheet runId={runId} callId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

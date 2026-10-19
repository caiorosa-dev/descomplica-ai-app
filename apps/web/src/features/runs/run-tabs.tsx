import { useState } from 'react';
import { ActivePill, FadeIn } from '@/components/motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { RunLiveState } from './events-reducer';
import { useRunResult, useRunText } from './queries';
import { SourceSheetProvider } from './source-sheet';
import { StageStepper } from './stage-stepper';
import { DocumentTab } from './tabs/document-tab';
import { FactsTab } from './tabs/facts-tab';
import { LogsTab } from './tabs/logs-tab';
import { SummaryTab } from './tabs/summary-tab';
import { VerificationTab } from './tabs/verification-tab';

const TRIGGER =
  'relative isolate rounded-full px-4 transition-colors data-active:bg-transparent data-active:shadow-none group-data-[variant=default]/tabs-list:data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent';

const TABS = [
  { value: 'summary', label: 'Resumo' },
  { value: 'facts', label: 'Dados' },
  { value: 'verification', label: 'Verificação' },
  { value: 'document', label: 'Original' },
  { value: 'logs', label: 'Detalhes' },
] as const;
type TabValue = (typeof TABS)[number]['value'];

function Count({ n, alert }: { n: number; alert?: boolean }) {
  return (
    <span
      className={cn(
        'ml-1.5 rounded-full px-1.5 text-xs tabular-nums',
        alert ? 'bg-destructive-soft text-destructive' : 'bg-muted text-muted-foreground',
      )}
    >
      {n}
    </span>
  );
}

export function RunTabs({ runId, live }: { runId: string; live: RunLiveState | null }) {
  const result = useRunResult(runId, true);
  const text = useRunText(runId);
  const [tab, setTab] = useState<TabValue>('summary');
  if (result.isPending) return <Skeleton className="h-96 w-full rounded-3xl" />;
  if (result.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>Não deu para carregar o resultado</AlertTitle>
        <AlertDescription>{result.error.message}</AlertDescription>
      </Alert>
    );
  const alerts = result.data.alerts;
  return (
    <SourceSheetProvider runId={runId}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="flex flex-col gap-6">
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList className="h-11! rounded-full p-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className={TRIGGER}>
                {tab === t.value && <ActivePill layoutId="run-tab-pill" />}
                {t.label}
                {t.value === 'facts' && <Count n={result.data.facts.length} />}
                {t.value === 'verification' && alerts.length > 0 && (
                  <Count n={alerts.length} alert={alerts.some((a) => a.severity === 'high')} />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="summary" className="text-base">
          <FadeIn>
            <SummaryTab result={result.data} text={text.data} />
          </FadeIn>
        </TabsContent>
        <TabsContent value="facts">
          <FadeIn>
            <FactsTab result={result.data} />
          </FadeIn>
        </TabsContent>
        <TabsContent value="verification">
          <FadeIn>
            <VerificationTab result={result.data} text={text.data} />
          </FadeIn>
        </TabsContent>
        <TabsContent value="document">
          <FadeIn>
            <DocumentTab result={result.data} text={text.data} />
          </FadeIn>
        </TabsContent>
        <TabsContent value="logs">
          <FadeIn className="flex flex-col gap-6">
            {live && (
              <section className="rounded-3xl border bg-card p-5">
                <h2 className="mb-4 font-semibold">Etapas</h2>
                <StageStepper stages={live.stages} />
              </section>
            )}
            <LogsTab runId={runId} live={live} />
          </FadeIn>
        </TabsContent>
      </Tabs>
    </SourceSheetProvider>
  );
}

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
  'rounded-full px-4 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground';

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
      <Tabs defaultValue="summary" className="flex flex-col gap-6">
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList className="h-11! rounded-full p-1">
            <TabsTrigger value="summary" className={TRIGGER}>
              Resumo
            </TabsTrigger>
            <TabsTrigger value="facts" className={TRIGGER}>
              Dados
              <Count n={result.data.facts.length} />
            </TabsTrigger>
            <TabsTrigger value="verification" className={TRIGGER}>
              Verificação
              {alerts.length > 0 && <Count n={alerts.length} alert={alerts.some((a) => a.severity === 'high')} />}
            </TabsTrigger>
            <TabsTrigger value="document" className={TRIGGER}>
              Original
            </TabsTrigger>
            <TabsTrigger value="logs" className={TRIGGER}>
              Detalhes
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="summary" className="text-base">
          <SummaryTab result={result.data} text={text.data} />
        </TabsContent>
        <TabsContent value="facts">
          <FactsTab result={result.data} />
        </TabsContent>
        <TabsContent value="verification">
          <VerificationTab result={result.data} text={text.data} />
        </TabsContent>
        <TabsContent value="document">
          <DocumentTab result={result.data} text={text.data} />
        </TabsContent>
        <TabsContent value="logs" className="flex flex-col gap-6">
          {live && (
            <section className="rounded-3xl border bg-card p-5">
              <h2 className="mb-4 font-semibold">Etapas</h2>
              <StageStepper stages={live.stages} />
            </section>
          )}
          <LogsTab runId={runId} live={live} />
        </TabsContent>
      </Tabs>
    </SourceSheetProvider>
  );
}

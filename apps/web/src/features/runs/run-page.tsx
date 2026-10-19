import { TERMINAL_RUN_STATUSES } from '@app/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRun } from './queries';
import { RunHeader } from './run-header';
import { RunTabs } from './run-tabs';
import { StageStepper } from './stage-stepper';
import { useRunEvents } from './use-run-events';

export function RunPage({ runId }: { runId: string }) {
  const run = useRun(runId);
  const live = useRunEvents(runId, run.data);

  if (run.isPending) return <Skeleton className="h-40 w-full" />;
  if (run.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar a execução</AlertTitle>
        <AlertDescription>{run.error.message}</AlertDescription>
      </Alert>
    );

  const status = live?.status ?? run.data.status;
  const finished = TERMINAL_RUN_STATUSES.includes(status);
  return (
    <div className="flex flex-col gap-6">
      <RunHeader run={run.data} live={live} />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Etapas</CardTitle>
          </CardHeader>
          <CardContent>
            {live ? <StageStepper stages={live.stages} /> : <Skeleton className="h-64 w-full" />}
          </CardContent>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          {!finished ? (
            <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Processando">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : run.data.status === 'completed' || status === 'completed' ? (
            <RunTabs runId={runId} />
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Execução {status === 'cancelled' ? 'cancelada' : 'interrompida ou com falha'}</AlertTitle>
              <AlertDescription>{run.data.error?.userMessage ?? 'Veja as etapas ao lado.'}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

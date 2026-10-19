import { TERMINAL_RUN_STATUSES } from '@app/shared';
import { Link } from '@tanstack/react-router';
import { GitCompareArrowsIcon, RotateCcwIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { EASE_OUT } from '@/components/motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProviders } from '../documents/queries';
import { CancelButton } from './cancel-button';
import { ExportMenu } from './export-menu';
import { ProcessingView } from './processing-view';
import { useRun } from './queries';
import { RerunDialog } from './rerun-dialog';
import { ResumeCard } from './resume-card';
import { RunErrorCard } from './run-error-card';
import { RunHeader } from './run-header';
import { RunTabs } from './run-tabs';
import { StageStepper } from './stage-stepper';
import { useRunEvents } from './use-run-events';

export function RunPage({ runId }: { runId: string }) {
  const run = useRun(runId);
  const live = useRunEvents(runId, run.data);
  const providers = useProviders();
  const [rerunOpen, setRerunOpen] = useState(false);

  if (run.isPending)
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pt-10">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  if (run.isError)
    return (
      <Alert variant="destructive" className="mx-auto mt-10 max-w-xl">
        <AlertTitle>Não deu para abrir este resultado</AlertTitle>
        <AlertDescription>{run.error.message}</AlertDescription>
      </Alert>
    );

  const status = live?.status ?? run.data.status;
  const finished = TERMINAL_RUN_STATUSES.includes(status);
  const completed = run.data.status === 'completed' || status === 'completed';
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <RunHeader
        run={run.data}
        live={live}
        actions={
          <>
            <CancelButton runId={runId} status={status} />
            {completed && (
              <Button asChild variant="ghost">
                <Link to="/compare" search={{ from: runId }}>
                  <GitCompareArrowsIcon data-icon="inline-start" />
                  Comparar
                </Link>
              </Button>
            )}
            {finished && (
              <Button variant="ghost" onClick={() => setRerunOpen(true)} disabled={!providers.data}>
                <RotateCcwIcon data-icon="inline-start" />
                Refazer
              </Button>
            )}
            {completed && <ExportMenu run={run.data} />}
          </>
        }
      />
      {providers.data && rerunOpen && (
        <RerunDialog run={run.data} providers={providers.data} open onOpenChange={setRerunOpen} />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={!finished ? 'processing' : completed ? 'result' : 'stopped'}
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.99 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          {!finished ? (
            <ProcessingView live={live} />
          ) : completed ? (
            <RunTabs runId={runId} live={live} />
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
              {status === 'interrupted' ? <ResumeCard run={run.data} /> : <RunErrorCard run={run.data} />}
              {live && (
                <div className="rounded-3xl border bg-card p-5">
                  <StageStepper stages={live.stages} />
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

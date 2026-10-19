import { STAGE_ORDER, type StageName } from '@app/shared';
import { AnimatePresence, motion } from 'motion/react';
import { Beam } from '@/components/beam';
import { ThinkingOrb } from '@/components/thinking-orb';
import { Skeleton } from '@/components/ui/skeleton';
import type { RunLiveState } from './events-reducer';
import { StageStepper } from './stage-stepper';

const DOING: Record<StageName, string> = {
  text_extraction: 'Lendo o documento',
  information_extraction: 'Separando os dados importantes',
  summarization: 'Escrevendo o resumo',
  similarity: 'Comparando com o original',
  verification: 'Conferindo cada dado',
  report: 'Montando o resultado',
};

export function ProcessingView({ live }: { live: RunLiveState | null }) {
  const current = live ? (STAGE_ORDER.find((n) => live.stages[n].status === 'running') ?? null) : null;
  const step = current ? STAGE_ORDER.indexOf(current) + 1 : null;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 py-8">
      <div className="flex flex-col items-center gap-5 text-center" role="status" aria-live="polite">
        <ThinkingOrb stage={current} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current ?? 'queued'}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-1"
          >
            <p className="font-heading text-2xl font-semibold">{current ? DOING[current] : 'Na fila'}</p>
            <p className="text-sm text-muted-foreground">
              {step ? `Etapa ${step} de ${STAGE_ORDER.length}` : 'Começa em instantes'}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
      <Beam active className="w-full">
        <div className="w-full rounded-3xl border bg-card p-5">
          {live ? <StageStepper stages={live.stages} /> : <Skeleton className="h-64 w-full" />}
        </div>
      </Beam>
    </div>
  );
}

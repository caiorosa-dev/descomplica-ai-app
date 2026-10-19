import type { RunDto } from '@app/shared';
import { PlayIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api-client';
import { STAGE_LABELS } from '@/lib/labels';
import { firstUnfinishedStage, useRerun } from './actions';

export function ResumeCard({ run }: { run: RunDto }) {
  const rerun = useRerun(run.id);
  const from = firstUnfinishedStage(run);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execução interrompida</CardTitle>
        <CardDescription>
          A API reiniciou durante a execução. Retome a partir de “{STAGE_LABELS[from]}”, reaproveitando o que já foi
          feito.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          disabled={rerun.isPending}
          onClick={() =>
            rerun.mutate(
              { fromStage: from },
              { onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível retomar.') },
            )
          }
        >
          {rerun.isPending ? <Spinner data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
          Retomar
        </Button>
      </CardFooter>
    </Card>
  );
}

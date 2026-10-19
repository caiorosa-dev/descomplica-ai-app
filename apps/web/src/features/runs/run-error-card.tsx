import type { RunDto } from '@app/shared';
import { RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api-client';
import { STAGE_LABELS } from '@/lib/labels';
import { useRerun } from './actions';

export function RunErrorCard({ run }: { run: RunDto }) {
  const failed = run.stages.find((s) => s.status === 'failed');
  const rerun = useRerun(run.id);
  const error = failed?.error ?? run.error;
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>{run.status === 'cancelled' ? 'Execução cancelada' : 'A execução falhou'}</CardTitle>
        <CardDescription>
          {failed ? `Etapa: ${STAGE_LABELS[failed.stage]}` : 'Nenhuma etapa marcada como falha.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p>{error?.userMessage ?? 'Erro desconhecido.'}</p>
        {error?.code && <p className="text-sm text-muted-foreground">Código: {error.code}</p>}
      </CardContent>
      {failed && (
        <CardFooter>
          <Button
            disabled={rerun.isPending}
            onClick={() =>
              rerun.mutate(
                { fromStage: failed.stage },
                { onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível refazer.') },
              )
            }
          >
            {rerun.isPending ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
            Tentar de novo a partir desta etapa
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

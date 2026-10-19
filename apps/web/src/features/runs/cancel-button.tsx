import type { RunStatus } from '@app/shared';
import { SquareIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api-client';
import { useCancelRun } from './actions';

export function CancelButton({ runId, status }: { runId: string; status: RunStatus }) {
  const cancel = useCancelRun(runId);
  if (status !== 'queued' && status !== 'running') return null;
  return (
    <Button
      variant="outline"
      disabled={cancel.isPending}
      onClick={() =>
        cancel.mutate(undefined, {
          onSuccess: () => toast.info('Cancelamento solicitado'),
          onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível cancelar.'),
        })
      }
    >
      {cancel.isPending ? <Spinner data-icon="inline-start" /> : <SquareIcon data-icon="inline-start" />}
      Cancelar
    </Button>
  );
}

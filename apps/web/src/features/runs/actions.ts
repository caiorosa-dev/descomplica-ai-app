import { type DeepPartial, type PipelineConfig, RunDto, STAGE_ORDER, type StageName } from '@app/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '@/lib/api-client';

const DONE = new Set(['completed', 'reused', 'overridden']);

/** Stages a rerun can start from: every stage before it must have a checkpoint. */
export function rerunnableStages(run: RunDto): StageName[] {
  const out: StageName[] = [];
  for (const stage of STAGE_ORDER) {
    out.push(stage);
    if (!DONE.has(run.stages.find((s) => s.stage === stage)?.status ?? '')) break;
  }
  return out;
}

export function firstUnfinishedStage(run: RunDto): StageName {
  return STAGE_ORDER.find((stage) => !DONE.has(run.stages.find((s) => s.stage === stage)?.status ?? '')) ?? 'report';
}

export function useRerun(runId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { fromStage: StageName; configOverrides?: DeepPartial<PipelineConfig> }) =>
      api.post(`/runs/${runId}/rerun`, body, RunDto),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void navigate({ to: '/runs/$runId', params: { runId: run.id } });
    },
  });
}

export function useCancelRun(runId: string) {
  return useMutation({ mutationFn: () => api.post(`/runs/${runId}/cancel`, {}, RunDto) });
}

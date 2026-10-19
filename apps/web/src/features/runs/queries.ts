import { DocumentDto, RunDto, RunResultDto, RunTextDto } from '@app/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export const runKey = (runId: string) => ['run', runId] as const;

export const useRun = (runId: string) =>
  useQuery({ queryKey: runKey(runId), queryFn: () => api.get(`/runs/${runId}`, RunDto) });

export const useRunResult = (runId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['run', runId, 'result'],
    queryFn: () => api.get(`/runs/${runId}/result`, RunResultDto),
    enabled,
  });

export const useRunText = (runId: string, enabled = true) =>
  useQuery({
    queryKey: ['run', runId, 'text'],
    queryFn: () => api.get(`/runs/${runId}/text`, RunTextDto),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useDocument = (documentId: string | undefined) =>
  useQuery({
    queryKey: ['document', documentId],
    queryFn: () => api.get(`/documents/${documentId}`, DocumentDto),
    enabled: Boolean(documentId),
  });

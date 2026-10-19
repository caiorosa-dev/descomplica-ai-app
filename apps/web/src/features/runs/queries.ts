import { DocumentDto, LlmCallDto, LlmCallSummaryDto, RunDto, RunResultDto, RunTextDto } from '@app/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
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

export const useLlmCalls = (runId: string) =>
  useQuery({
    queryKey: ['run', runId, 'llm-calls'],
    queryFn: () => api.get(`/runs/${runId}/llm-calls`, z.array(LlmCallSummaryDto)),
  });

export const useLlmCall = (runId: string, callId: string | null) =>
  useQuery({
    queryKey: ['run', runId, 'llm-calls', callId],
    queryFn: () => api.get(`/runs/${runId}/llm-calls/${callId}`, LlmCallDto),
    enabled: callId !== null,
  });

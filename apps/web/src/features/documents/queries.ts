import { type DeepPartial, DocumentDto, type PipelineConfig, PresetDto, ProvidersDto, RunDto } from '@app/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { api } from '@/lib/api-client';

export const useDocuments = () =>
  useQuery({ queryKey: ['documents'], queryFn: () => api.get('/documents', z.array(DocumentDto)) });

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File; onProgress?: (fraction: number) => void }) =>
      api.upload(args.file, args.onProgress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export const usePresets = () =>
  useQuery({ queryKey: ['presets'], queryFn: () => api.get('/presets', z.array(PresetDto)) });

export const useProviders = () =>
  useQuery({ queryKey: ['providers'], queryFn: () => api.get('/providers', ProvidersDto) });

export function useCreateRun() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: { documentId: string; presetId: string; configOverrides?: DeepPartial<PipelineConfig> }) =>
      api.post('/runs', body, RunDto),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void navigate({ to: '/runs/$runId', params: { runId: run.id } });
    },
  });
}

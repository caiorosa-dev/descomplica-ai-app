import { PresetDto } from '@app/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PresetFormValues } from './preset-editor';

function useInvalidatePresets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['presets'] });
}

export function useSavePreset() {
  const invalidate = useInvalidatePresets();
  return useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: PresetFormValues }) =>
      id
        ? api.put(
            `/presets/${id}`,
            { name: values.name, description: values.description, config: values.config },
            PresetDto,
          )
        : api.post('/presets', values, PresetDto),
    onSuccess: invalidate,
  });
}

export function useDuplicatePreset() {
  const invalidate = useInvalidatePresets();
  return useMutation({
    mutationFn: (id: string) => api.post(`/presets/${id}/duplicate`, {}, PresetDto),
    onSuccess: invalidate,
  });
}

export function useDeletePreset() {
  const invalidate = useInvalidatePresets();
  return useMutation({ mutationFn: (id: string) => api.del(`/presets/${id}`), onSuccess: invalidate });
}

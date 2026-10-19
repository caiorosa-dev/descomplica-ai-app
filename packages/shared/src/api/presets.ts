import { z } from 'zod';
import { PipelineConfig } from '../config/pipeline-config';

export const PresetDto = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  config: PipelineConfig,
  isBuiltin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PresetDto = z.infer<typeof PresetDto>;

export const PRESET_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const CreatePresetBody = z.object({
  slug: z.string().regex(PRESET_SLUG, 'Use letras minúsculas, números e hífens'),
  name: z.string().min(1),
  description: z.string(),
  config: PipelineConfig,
});
export type CreatePresetBody = z.input<typeof CreatePresetBody>;

export const UpdatePresetBody = CreatePresetBody.omit({ slug: true }).partial();
export type UpdatePresetBody = z.input<typeof UpdatePresetBody>;

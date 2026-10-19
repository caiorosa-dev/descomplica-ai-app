import {
  BUILTIN_PRESETS,
  type DocumentDto,
  MODEL_CATALOG,
  type PresetDto,
  type ProvidersDto,
  parsePipelineConfig,
} from '@app/shared';

export const preset = (slug: string): PresetDto => {
  const p = BUILTIN_PRESETS.find((b) => b.slug === slug);
  if (!p) throw new Error(`Unknown builtin preset ${slug}`);
  return {
    id: crypto.randomUUID(),
    slug,
    name: p.name,
    description: p.description,
    config: parsePipelineConfig(p.config),
    isBuiltin: true,
    createdAt: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-18T00:00:00Z',
  };
};

export const openaiDefault = preset('openai-default');
export const anthropicDefault = preset('anthropic-default');

export const onlyOpenai: ProvidersDto = {
  providers: [
    { id: 'openai', configured: true },
    { id: 'anthropic', configured: false },
  ],
  models: [...MODEL_CATALOG],
};

export const makeDoc = (overrides: Partial<DocumentDto> = {}): DocumentDto => ({
  id: crypto.randomUUID(),
  filename: 'acordao.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 100,
  sha256: 'x',
  source: 'upload',
  corpusKey: null,
  createdAt: '2026-10-18T00:00:00Z',
  detectedType: null,
  pages: null,
  runCount: 0,
  lastRunStatus: null,
  lastRunId: null,
  ...overrides,
});

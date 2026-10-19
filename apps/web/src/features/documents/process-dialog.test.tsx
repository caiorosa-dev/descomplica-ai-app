import {
  BUILTIN_PRESETS,
  type DocumentDto,
  MODEL_CATALOG,
  type PresetDto,
  type ProvidersDto,
  parsePipelineConfig,
} from '@app/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProcessDialog, presetAvailability } from './process-dialog';

const preset = (slug: string): PresetDto => {
  const p = BUILTIN_PRESETS.find((b) => b.slug === slug)!;
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
const openaiDefault = preset('openai-default');
const anthropicDefault = preset('anthropic-default');
const onlyOpenai: ProvidersDto = {
  providers: [
    { id: 'openai', configured: true },
    { id: 'anthropic', configured: false },
  ],
  models: [...MODEL_CATALOG],
};
const doc: DocumentDto = {
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
};

test('presetAvailability lists missing providers', () => {
  expect(presetAvailability(anthropicDefault, onlyOpenai)).toEqual({ available: false, missing: ['anthropic'] });
  expect(presetAvailability(openaiDefault, onlyOpenai)).toEqual({ available: true, missing: [] });
});

test('preset needing anthropic is disabled when anthropic is not configured', async () => {
  render(
    <TooltipProvider>
      <ProcessDialog
        document={doc}
        presets={[openaiDefault, anthropicDefault]}
        providers={onlyOpenai}
        open
        onOpenChange={() => {}}
      />
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole('combobox'));
  expect(screen.getByRole('option', { name: /anthropic-default/i })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('option', { name: /openai-default/i })).not.toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument();
});

test('confirm sends the chosen preset', async () => {
  const onConfirm = vi.fn();
  render(
    <TooltipProvider>
      <ProcessDialog
        document={doc}
        presets={[openaiDefault, anthropicDefault]}
        providers={onlyOpenai}
        open
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(screen.getByRole('option', { name: /openai-default/i }));
  await userEvent.click(screen.getByRole('button', { name: /processar/i }));
  expect(onConfirm).toHaveBeenCalledWith(openaiDefault.id);
});

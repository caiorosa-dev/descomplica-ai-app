import type { ModelCatalogEntry, ModelSettings } from '@app/shared';
import { buildCallSettings } from './call-settings';

const base: Omit<ModelCatalogEntry, 'ref' | 'provider' | 'supportsTemperature' | 'supportsReasoningEffort'> = {
  kind: 'language',
  label: 'x',
  contextWindow: 100_000,
  supportsStructuredOutput: true,
  supportsSeed: false,
  embeddingDimensions: null,
  pricePerMTokens: { input: 1, output: 1 },
};
const openaiReasoningEntry: ModelCatalogEntry = {
  ...base,
  ref: 'openai:r',
  provider: 'openai',
  supportsTemperature: false,
  supportsReasoningEffort: true,
};
const anthropicEffortEntry: ModelCatalogEntry = {
  ...base,
  ref: 'anthropic:e',
  provider: 'anthropic',
  supportsTemperature: false,
  supportsReasoningEffort: true,
};
const claudeEntry: ModelCatalogEntry = {
  ...base,
  ref: 'anthropic:t',
  provider: 'anthropic',
  supportsTemperature: true,
  supportsReasoningEffort: false,
};
const settings: ModelSettings = { model: 'x', temperature: 0.3, reasoningEffort: 'medium', maxOutputTokens: 1234 };

test('reasoning model uses reasoningEffort, never temperature/topP', () => {
  const s = buildCallSettings(
    { model: 'x', temperature: 0, reasoningEffort: 'medium', maxOutputTokens: null },
    openaiReasoningEntry,
    4000,
  );
  expect(s.temperature).toBeUndefined();
  expect(s.providerOptions?.openai?.reasoningEffort).toBe('medium');
  expect(s).not.toHaveProperty('topP');
});

test('anthropic effort goes to providerOptions.anthropic.effort', () => {
  const s = buildCallSettings(settings, anthropicEffortEntry, 4000);
  expect(s.providerOptions).toEqual({ anthropic: { effort: 'medium' } });
  expect(s.temperature).toBeUndefined();
});

test('claude uses temperature and no providerOptions', () => {
  const s = buildCallSettings(
    { model: 'x', temperature: 0.3, reasoningEffort: 'medium', maxOutputTokens: null },
    claudeEntry,
    4000,
  );
  expect(s.temperature).toBe(0.3);
  expect(s.providerOptions).toBeUndefined();
});

test('seed only when supported; maxOutputTokens falls back to agent default', () => {
  expect(buildCallSettings(settings, { ...claudeEntry, supportsSeed: true }, 4000).seed).toBe(42);
  expect(buildCallSettings(settings, claudeEntry, 4000).seed).toBeUndefined();
  expect(buildCallSettings({ ...settings, maxOutputTokens: null }, claudeEntry, 4000).maxOutputTokens).toBe(4000);
  expect(buildCallSettings(settings, claudeEntry, 4000).maxOutputTokens).toBe(1234);
});

test('reasoning models get output headroom for thinking tokens', () => {
  const low = buildCallSettings(
    { ...settings, reasoningEffort: 'low', maxOutputTokens: null },
    openaiReasoningEntry,
    800,
  );
  const high = buildCallSettings(
    { ...settings, reasoningEffort: 'high', maxOutputTokens: null },
    openaiReasoningEntry,
    800,
  );
  expect(low.maxOutputTokens).toBeGreaterThan(800);
  expect(high.maxOutputTokens).toBeGreaterThan(low.maxOutputTokens);
});

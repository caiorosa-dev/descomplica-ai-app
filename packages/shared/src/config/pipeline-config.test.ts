import { MODEL_REFS } from './catalog';
import { PipelineConfig, parsePipelineConfig } from './pipeline-config';
import { BUILTIN_PRESETS, requiredProviders } from './presets';

test('defaults', () => {
  const c = parsePipelineConfig({});
  expect(c.extraction.maxSinglePassTokens).toBe(60_000);
  expect(c.models.summarization.temperature).toBe(0.3);
  expect(c.similarity.headline).toBe('alignment_f1');
  expect(c.textExtraction.cleaning.llmCleanup).toBe('off');
});

test('slot defaults survive a partial slot override', () => {
  const c = parsePipelineConfig({ models: { summarization: { model: MODEL_REFS.openaiSmall } } });
  expect(c.models.summarization).toEqual({
    model: MODEL_REFS.openaiSmall,
    temperature: 0.3,
    reasoningEffort: 'medium',
    maxOutputTokens: null,
  });
  expect(c.models.extraction.model).toBe(MODEL_REFS.openaiMain);
});

test('rejects embedding model in a generation slot', () => {
  const r = PipelineConfig.safeParse({ models: { extraction: { model: MODEL_REFS.embeddingSmall } } });
  expect(r.success).toBe(false);
  expect(r.error!.issues[0]!.path).toEqual(['models', 'extraction', 'model']);
});

test('rejects language model as embedding model', () =>
  expect(PipelineConfig.safeParse({ similarity: { embeddingModel: MODEL_REFS.openaiMain } }).success).toBe(false));

test('rejects unknown ref', () =>
  expect(PipelineConfig.safeParse({ models: { extraction: { model: 'openai:does-not-exist' } } }).success).toBe(false));

test('presets parse and need the right providers', () => {
  expect(BUILTIN_PRESETS.map((p) => p.slug)).toEqual([
    'openai-default',
    'anthropic-default',
    'cross-verifier',
    'budget',
  ]);
  const bySlug = Object.fromEntries(BUILTIN_PRESETS.map((p) => [p.slug, parsePipelineConfig(p.config)]));
  expect([...requiredProviders(bySlug['anthropic-default']!)].sort()).toEqual(['anthropic', 'openai']);
  expect([...requiredProviders(bySlug['openai-default']!)]).toEqual(['openai']);
  expect([...requiredProviders(bySlug.budget!)]).toEqual(['openai']);
  expect(bySlug['cross-verifier']!.models.summarization.model).toBe(MODEL_REFS.openaiMain);
  expect(bySlug['cross-verifier']!.models.verification.model).toBe(MODEL_REFS.anthropicMain);
});

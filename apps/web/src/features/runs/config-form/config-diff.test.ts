import { MODEL_REFS, mergeConfig, parsePipelineConfig } from '@app/shared';
import { buildOverrides, CONFIG_BLOCK_STAGE, diffConfig, stageOfPath } from './config-diff';

test('diff and overrides', () => {
  const base = parsePipelineConfig({});
  const edited = mergeConfig(base, { summarization: { targetLength: 'short' } });
  expect(diffConfig(base, edited)).toEqual([{ path: 'summarization.targetLength', before: 'medium', after: 'short' }]);
  expect(buildOverrides(base, edited)).toEqual({ summarization: { targetLength: 'short' } });
});

test('arrays are compared whole and nested model slots get dotted paths', () => {
  const base = parsePipelineConfig({});
  const edited = mergeConfig(base, {
    extraction: { categories: ['date'] },
    models: { verification: { model: MODEL_REFS.anthropicMain } },
  });
  expect(diffConfig(base, edited)).toEqual([
    { path: 'models.verification.model', before: MODEL_REFS.openaiMain, after: MODEL_REFS.anthropicMain },
    { path: 'extraction.categories', before: base.extraction.categories, after: ['date'] },
  ]);
  expect(buildOverrides(base, edited)).toEqual({
    models: { verification: { model: MODEL_REFS.anthropicMain } },
    extraction: { categories: ['date'] },
  });
});

test('identical configs have no diff and no overrides', () => {
  const base = parsePipelineConfig({});
  expect(diffConfig(base, parsePipelineConfig({}))).toEqual([]);
  expect(buildOverrides(base, parsePipelineConfig({}))).toEqual({});
});

test('blocks map to the stage they affect', () => {
  expect(CONFIG_BLOCK_STAGE['models.cleaning']).toBe('text_extraction');
  expect(stageOfPath('models.extraction.model')).toBe('information_extraction');
  expect(stageOfPath('similarity.chunking.maxTokens')).toBe('similarity');
  expect(stageOfPath('verification.batchSize')).toBe('verification');
});

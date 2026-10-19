import { earliestStageAffected, mergeConfig } from './overrides';
import { parsePipelineConfig } from './pipeline-config';

test('mergeConfig keeps siblings', () => {
  const m = mergeConfig(parsePipelineConfig({}), { summarization: { targetLength: 'short' } });
  expect(m.summarization).toMatchObject({ targetLength: 'short', audience: 'layperson' });
});

test('mergeConfig replaces arrays and does not mutate the base', () => {
  const base = parsePipelineConfig({});
  const m = mergeConfig(base, { extraction: { categories: ['date'] } });
  expect(m.extraction.categories).toEqual(['date']);
  expect(base.extraction.categories).toHaveLength(6);
});

test('mergeConfig validates the result', () =>
  expect(() => mergeConfig(parsePipelineConfig({}), { summarization: { targetLength: 'huge' as 'short' } })).toThrow());

test('earliestStageAffected', () => {
  expect(earliestStageAffected({ summarization: { targetLength: 'short' } })).toBe('summarization');
  expect(
    earliestStageAffected({ models: { verification: { temperature: 0 } }, similarity: { headline: 'centroid' } }),
  ).toBe('similarity');
  expect(earliestStageAffected({ models: { cleaning: { reasoningEffort: 'high' } } })).toBe('text_extraction');
  expect(earliestStageAffected({ classification: { mode: 'generic' } })).toBe('information_extraction');
  expect(earliestStageAffected({})).toBeNull();
});

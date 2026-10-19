import { parsePipelineConfig } from '@app/shared';
import { cleanerAgent } from '../../../agents/cleaner/agent';
import { createTestContext } from '../../../testing/context';
import { createMockContext } from '../../../testing/mock-model';
import { textExtractionStage } from '../stage';
import type { LineDocument } from '../types';
import { applyLlmCleanup } from './llm-cleanup';

let id = 0;
const pageOf = (n: number, count: number) => ({
  number: n,
  height: 800,
  lines: Array.from({ length: count }, (_, i) => ({
    id: id++,
    text: `p${n}-linha-${i}`,
    y: 100 + i * 14,
    height: 11,
    page: n,
  })),
});
const doc = (): LineDocument => {
  id = 0;
  return { format: 'pdf', pages: [pageOf(1, 10), pageOf(2, 4)] };
};
const texts = (d: LineDocument) => d.pages.flatMap((p) => p.lines.map((l) => l.text));

test('edges mode sends only first/last 3 lines of each page', async () => {
  const ctx = createMockContext([[cleanerAgent, () => ({ removeLineIds: [], reasons: [] })]]);
  await applyLlmCleanup(doc(), 'edges', ctx);
  expect(ctx.calls).toHaveLength(1);
  const prompt = ctx.calls[0]!.prompt;
  for (const i of [0, 1, 2, 7, 8, 9]) expect(prompt).toContain(`p1-linha-${i}`);
  for (const i of [3, 4, 5, 6]) expect(prompt).not.toContain(`p1-linha-${i}`);
  for (const i of [0, 1, 2, 3]) expect(prompt).toContain(`p2-linha-${i}`);
});

test('full mode sends every line', async () => {
  const ctx = createMockContext([[cleanerAgent, () => ({ removeLineIds: [], reasons: [] })]]);
  await applyLlmCleanup(doc(), 'full', ctx);
  expect(ctx.calls[0]!.prompt).toContain('p1-linha-5');
});

test('removes returned ids and ignores unknown ids', async () => {
  const ctx = createMockContext([
    [cleanerAgent, () => ({ removeLineIds: [2, 999], reasons: [{ id: 2, reason: 'número de página' }] })],
  ]);
  const r = await applyLlmCleanup(doc(), 'full', ctx);
  expect(r.removed).toEqual([{ rule: 'llm_cleaner', page: 1, text: 'p1-linha-2' }]);
  expect(texts(r.doc)).not.toContain('p1-linha-2');
  expect(texts(r.doc)).toHaveLength(13);
});

test('edges mode ignores ids of lines it did not send', async () => {
  const ctx = createMockContext([[cleanerAgent, () => ({ removeLineIds: [4], reasons: [] })]]);
  expect((await applyLlmCleanup(doc(), 'edges', ctx)).removed).toEqual([]);
});

test('full mode batches 200 lines per call', async () => {
  id = 0;
  const big: LineDocument = { format: 'pdf', pages: [pageOf(1, 450)] };
  const ctx = createMockContext([[cleanerAgent, () => ({ removeLineIds: [], reasons: [] })]]);
  await applyLlmCleanup(big, 'full', ctx);
  expect(ctx.calls).toHaveLength(3);
});

const input = { buffer: new TextEncoder().encode('Linha um.\nLinha dois.'), filename: 'a.txt' };

test('stage makes no LLM call when llmCleanup is off', async () => {
  const ctx = createTestContext();
  await textExtractionStage.run(input, ctx);
  expect(ctx.recorded.llm).toHaveLength(0);
});

test('stage calls the cleaner when llmCleanup is on', async () => {
  const ctx = createMockContext(
    [[cleanerAgent, () => ({ removeLineIds: [0], reasons: [{ id: 0, reason: 'ruído' }] })]],
    {
      config: parsePipelineConfig({ textExtraction: { cleaning: { llmCleanup: 'full' } } }),
    },
  );
  const out = await textExtractionStage.run(input, ctx);
  expect(out.canonicalText).toBe('Linha dois.');
  expect(out.cleaningReport.removedByRule).toEqual([{ rule: 'llm_cleaner', count: 1 }]);
  expect(ctx.recorded.llm).toHaveLength(1);
});

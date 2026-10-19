import { parsePipelineConfig } from '@app/shared';
import { createTestContext } from '../../testing/context';
import { makePdf, makePdfLayout } from '../../testing/fixtures';
import { textExtractionStage } from './stage';

const stjLikePages = [1, 2, 3, 4].map((n) => [
  { text: 'SUPERIOR TRIBUNAL DE JUSTIÇA', y: 40 },
  { text: 'a obriga-', y: 300 },
  { text: 'ção de pagar.', y: 314 },
  { text: `Página ${n} de 4`, y: 800 },
]);
// The synthetic pages hold ~60 characters each, below the default density threshold of 200.
const lowDensity = (extra: object = {}) =>
  createTestContext({ config: parsePipelineConfig({ textExtraction: { minCharsPerPage: 10, ...extra } }) });

test('stage cleans a synthetic STJ-like pdf', async () => {
  const pdf = await makePdfLayout(stjLikePages);
  const ctx = lowDensity();
  const out = await textExtractionStage.run({ buffer: pdf, filename: 'x.pdf' }, ctx);
  expect(out.sourceFormat).toBe('pdf');
  expect(out.canonicalText).toContain('obrigação de pagar.');
  expect(out.canonicalText).not.toContain('Página');
  expect(out.canonicalText).not.toContain('SUPERIOR TRIBUNAL');
  expect(out.cleaningReport.removedByRule).toEqual(expect.arrayContaining([{ rule: 'repeated_edge', count: 8 }]));
  expect(out.stats.pages).toBe(4);
  expect(out.stats.words).toBe(out.canonicalText.split(/\s+/).length);
  expect(out.stats.estimatedTokens).toBeGreaterThan(0);
  expect(out.cleaningReport.charsAfter).toBe(out.canonicalText.length);
  expect(out.cleaningReport.charsBefore).toBeGreaterThan(out.cleaningReport.charsAfter);
  expect(out.pageMap.map((p) => p.page)).toEqual([1, 2, 3, 4]);
  expect(ctx.emitted.progress).toContain('Removendo cabeçalhos e rodapés');
  expect(textExtractionStage.output.parse(out)).toEqual(out);
});

test('toggle off keeps headers', async () => {
  const out = await textExtractionStage.run(
    { buffer: await makePdfLayout(stjLikePages), filename: 'x.pdf' },
    lowDensity({ cleaning: { removeRepeatedHeadersFooters: false } }),
  );
  expect(out.canonicalText).toContain('SUPERIOR TRIBUNAL DE JUSTIÇA');
  expect(out.cleaningReport.removedByRule.find((r) => r.rule === 'repeated_edge')).toBeUndefined();
});

test('rebuildParagraphs off keeps one paragraph per line', async () => {
  const out = await textExtractionStage.run(
    { buffer: new TextEncoder().encode('O recurso foi\nprovido'), filename: 'a.txt' },
    createTestContext({ config: parsePipelineConfig({ textExtraction: { cleaning: { rebuildParagraphs: false } } }) }),
  );
  expect(out.canonicalText).toBe('O recurso foi\n\nprovido');
});

test('FILE_TOO_LARGE', async () => {
  const ctx = createTestContext({ config: parsePipelineConfig({ textExtraction: { maxFileSizeMb: 0.0001 } }) });
  await expect(
    textExtractionStage.run({ buffer: new Uint8Array(1000), filename: 'big.txt' }, ctx),
  ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
});

test('LOW_TEXT_DENSITY', async () => {
  const pdf = await makePdf([['x'], ['x'], ['x']]);
  await expect(
    textExtractionStage.run({ buffer: pdf, filename: 'scan.pdf' }, createTestContext()),
  ).rejects.toMatchObject({
    code: 'LOW_TEXT_DENSITY',
  });
});

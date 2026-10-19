import {
  type InformationExtractionOutput,
  MODEL_REFS,
  parsePipelineConfig,
  type SummarizationOutput,
  type Summary,
  type TextExtractionOutput,
} from '@app/shared';
import { createTestContext } from '../../testing/context';
import { createFakeEmbedder } from '../../testing/fake-embedder';
import { segmentDocument } from '../information-extraction/segment';
import { similarityStage } from './stage';

const paragraphs = [
  'O tribunal negou provimento ao recurso especial da empresa de telefonia.',
  'O prazo para pagamento da indenização é de quinze dias úteis após a intimação.',
  'A multa diária foi fixada em mil reais por dia de atraso no cumprimento.',
  'A decisão foi unânime e seguiu o voto do relator da Quarta Turma.',
  'As custas processuais ficam a cargo da parte vencida no processo.',
];
const canonical = paragraphs.join('\n\n');
const text: TextExtractionOutput = {
  sourceFormat: 'txt',
  canonicalText: canonical,
  pageMap: [{ page: 1, start: 0, end: canonical.length }],
  cleaningReport: { removed: [], charsBefore: canonical.length, charsAfter: canonical.length, removedByRule: [] },
  stats: { pages: 1, words: 60, estimatedTokens: 90 },
};
const info: InformationExtractionOutput = {
  classification: {
    documentType: 'generic',
    subtype: null,
    confidence: 'high',
    rationale: 'x',
    metadata: { issuer: null, identifier: null, date: null, judgingBody: null, rapporteur: null },
  },
  sections: segmentDocument(canonical, 'generic').sections,
  facts: [],
  notFound: [],
  ambiguities: [],
};
const summarizationOf = (summary: Summary): SummarizationOutput => ({
  summary,
  readability: { source: 40, summary: 60 },
  compressionRatio: 2,
});
const repeating: Summary = {
  title: 't',
  overview: paragraphs[0]!,
  sections: [{ heading: 'A', paragraphs: paragraphs.slice(1).map((p) => ({ text: p, factRefs: [] })) }],
  glossary: [],
};
const inputWhereSummaryRepeatsSource = { text, info, summarization: summarizationOf(repeating) };
const ctxWith = (config: object = {}) =>
  createTestContext({
    embedder: createFakeEmbedder(),
    config: parsePipelineConfig({ similarity: { chunking: { maxTokens: 30, overlapTokens: 5 } }, ...config }),
  });

test('summary equal to source scores ~1', async () => {
  const out = await similarityStage.run(inputWhereSummaryRepeatsSource, ctxWith());
  expect(out.metrics.alignmentF1).toBeGreaterThan(0.95);
  expect(similarityStage.output.parse(out)).toEqual(out);
});

test('unrelated summary scores lower', async () => {
  const unrelated: Summary = { ...repeating, overview: 'Receita de bolo de cenoura com cobertura.', sections: [] };
  const a = await similarityStage.run(inputWhereSummaryRepeatsSource, ctxWith());
  const b = await similarityStage.run({ text, info, summarization: summarizationOf(unrelated) }, ctxWith());
  expect(b.metrics.alignmentF1).toBeLessThan(a.metrics.alignmentF1);
});

test('embedder called with configured model and dimensions', async () => {
  const embedder = createFakeEmbedder();
  await similarityStage.run(inputWhereSummaryRepeatsSource, createTestContext({ embedder }));
  expect(embedder.calls).toHaveLength(2);
  expect(embedder.calls[0]).toMatchObject({ model: MODEL_REFS.embeddingSmall, dimensions: null });
  expect(embedder.calls[1]!.texts[0]).toBe(paragraphs[0]);
});

test('headline follows config', async () => {
  const out = await similarityStage.run(
    inputWhereSummaryRepeatsSource,
    ctxWith({ similarity: { headline: 'centroid' } }),
  );
  expect(out.headline).toEqual({ metric: 'centroid', value: out.metrics.centroid });
});

test('highlight flags follow highlightBottomPercent', async () => {
  const none = await similarityStage.run(
    inputWhereSummaryRepeatsSource,
    ctxWith({ similarity: { highlightBottomPercent: 0 } }),
  );
  expect(none.coverageByChunk.every((c) => !c.highlighted)).toBe(true);
  const half = await similarityStage.run(
    inputWhereSummaryRepeatsSource,
    ctxWith({ similarity: { highlightBottomPercent: 50 } }),
  );
  expect(half.supportByParagraph.filter((p) => p.highlighted)).toHaveLength(
    Math.floor(half.supportByParagraph.length / 2),
  );
  expect(half.coverageByChunk.map((c) => c.chunkId)).toEqual(half.sourceChunks.map((c) => c.id));
  expect(half.supportByParagraph[0]!.chunkId).toBe('P00');
});

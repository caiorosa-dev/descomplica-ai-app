import {
  type Fact,
  type InformationExtractionOutput,
  parsePipelineConfig,
  type SimilarityOutput,
  type SummarizationOutput,
  type TextExtractionOutput,
} from '@app/shared';
import { claimExtractorAgent } from '../../agents/claim-extractor/agent';
import { verifierAgent } from '../../agents/verifier/agent';
import { createFakeEmbedder } from '../../testing/fake-embedder';
import { createMockContext, type MockResponder } from '../../testing/mock-model';
import { verificationStage } from './stage';

const canonical = 'O recurso foi negado.\n\nO prazo para recorrer é de 15 (quinze) dias úteis, contados da intimação.';
const quoteStart = canonical.indexOf('15 (quinze) dias úteis');
const deadline: Fact = {
  id: 'F01',
  category: 'deadline',
  label: 'Prazo para recorrer',
  value: { amount: 15, unit: 'days', businessDays: true, trigger: 'intimação' },
  evidence: [
    {
      quote: '15 (quinze) dias úteis',
      start: quoteStart,
      end: quoteStart + 22,
      page: 1,
      sectionId: 'S02',
      matchType: 'exact',
      matchScore: 1,
    },
  ],
  confidence: 'high',
  status: 'confirmed',
  uncertaintyReasons: [],
};
const text: TextExtractionOutput = {
  sourceFormat: 'txt',
  canonicalText: canonical,
  pageMap: [{ page: 1, start: 0, end: canonical.length }],
  cleaningReport: { removed: [], charsBefore: canonical.length, charsAfter: canonical.length, removedByRule: [] },
  stats: { pages: 1, words: 18, estimatedTokens: 30 },
};
const info: InformationExtractionOutput = {
  classification: {
    documentType: 'court_decision',
    subtype: null,
    confidence: 'high',
    rationale: 'x',
    metadata: { issuer: null, identifier: null, date: null, judgingBody: null, rapporteur: null },
  },
  sections: [
    { id: 'S01', kind: 'paragraph', label: 'Parágrafo 1', parentLabel: null, start: 0, end: 21 },
    { id: 'S02', kind: 'paragraph', label: 'Parágrafo 2', parentLabel: null, start: 23, end: canonical.length },
  ],
  facts: [deadline],
  notFound: [],
  ambiguities: [],
};
const summarization: SummarizationOutput = {
  summary: {
    title: 't',
    overview: 'O recurso foi negado.',
    sections: [{ heading: 'Prazos', paragraphs: [{ text: 'O prazo para recorrer é de 30 dias.', factRefs: ['F01'] }] }],
    glossary: [],
  },
  readability: { source: 50, summary: 70 },
  compressionRatio: 1.5,
};
const similarity: SimilarityOutput = {
  sourceChunks: [
    { id: 'C001', start: 0, end: 21, tokens: 6 },
    { id: 'C002', start: 23, end: canonical.length, tokens: 20 },
  ],
  summaryChunks: [],
  metrics: { centroid: 0.9, coverage: 0.8, support: 0.85, alignmentF1: 0.82 },
  headline: { metric: 'alignment_f1', value: 0.82 },
  coverageByChunk: [],
  supportByParagraph: [],
};
const inputWithWrongDeadline = { text, info, summarization, similarity };

const deadlineClaim30 = () => ({
  claims: [
    {
      text: 'O prazo para recorrer é de 30 dias.',
      paragraphIndexInInput: 1,
      category: 'deadline',
      value: { amount: 30, unit: 'days', businessDays: null, trigger: null },
    },
  ],
});
const divergentVerdict: MockResponder = ({ prompt }) => ({
  verdicts: [...prompt.matchAll(/itemId: (V\d+)/g)].map((m) => ({
    itemId: m[1],
    verdict: 'divergent',
    explanation: 'O resumo diz 30 dias; o documento diz 15 dias úteis.',
    usedQuotes: ['15 (quinze) dias úteis'],
  })),
});
const ctxWithMocks = (m: { claimExtractor: MockResponder; verifier: MockResponder }, config: object = {}) =>
  createMockContext(
    [
      [claimExtractorAgent, m.claimExtractor],
      [verifierAgent, m.verifier],
    ],
    { embedder: createFakeEmbedder(), config: parsePipelineConfig(config) },
  );

test('stage: wrong deadline in summary yields high divergence alert', async () => {
  const out = await verificationStage.run(
    inputWithWrongDeadline,
    ctxWithMocks({ claimExtractor: deadlineClaim30, verifier: divergentVerdict }),
  );
  expect(out.alerts).toContainEqual(
    expect.objectContaining({ type: 'divergence', severity: 'high', category: 'deadline' }),
  );
  const alert = out.alerts[0]!;
  expect(alert.id).toBe('AL01');
  expect(alert.sourceEvidence).toEqual([{ start: quoteStart, end: quoteStart + 22, page: 1 }]);
  expect(out.items.every((i) => i.decidedBy === 'llm')).toBe(true);
  expect(out.metrics.factualConsistency).toBe(0);
  expect(verificationStage.output.parse(out)).toEqual(out);
});

test('invalid verdict for direction becomes unverifiable with warning', async () => {
  const supportedForAll: MockResponder = ({ prompt }) => ({
    verdicts: [...prompt.matchAll(/itemId: (V\d+)/g)].map((m) => ({
      itemId: m[1],
      verdict: 'supported',
      explanation: 'ok',
      usedQuotes: [],
    })),
  });
  const ctx = ctxWithMocks({ claimExtractor: deadlineClaim30, verifier: supportedForAll });
  const out = await verificationStage.run(inputWithWrongDeadline, ctx);
  expect(out.items.find((i) => i.direction === 'source_to_summary')!.verdict).toBe('unverifiable');
  expect(out.items.find((i) => i.direction === 'summary_to_source')!.verdict).toBe('supported');
  expect(ctx.emitted.warnings.map((w) => w.code)).toContain('verifier_invalid_verdict');
});

test('missing verdict becomes unverifiable', async () => {
  const out = await verificationStage.run(
    inputWithWrongDeadline,
    ctxWithMocks({ claimExtractor: deadlineClaim30, verifier: () => ({ verdicts: [] }) }),
  );
  expect(out.items.every((i) => i.verdict === 'unverifiable')).toBe(true);
  expect(out.items[0]!.explanation).toBe('O verificador não retornou veredito para este item.');
});

test('directions config limits items', async () => {
  const out = await verificationStage.run(
    inputWithWrongDeadline,
    ctxWithMocks(
      { claimExtractor: deadlineClaim30, verifier: divergentVerdict },
      { verification: { directions: ['summary_to_source'] } },
    ),
  );
  expect(out.items.some((i) => i.direction === 'source_to_summary')).toBe(false);
  expect(out.metrics.factualConsistency).toBeNull();
});

test('document without facts and summary without claims completes (Review Focus 3)', async () => {
  const ctx = ctxWithMocks({ claimExtractor: () => ({ claims: [] }), verifier: divergentVerdict });
  const out = await verificationStage.run({ ...inputWithWrongDeadline, info: { ...info, facts: [] } }, ctx);
  expect(out).toEqual({
    claims: [],
    items: [],
    alerts: [],
    metrics: { factualConsistency: null, claimSupport: null, unverifiableCount: 0 },
  });
  expect(ctx.calls.filter((c) => c.agent === 'verifier')).toHaveLength(0);
});

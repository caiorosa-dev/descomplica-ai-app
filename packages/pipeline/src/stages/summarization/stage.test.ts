import {
  type Fact,
  type InformationExtractionOutput,
  parsePipelineConfig,
  type Summary,
  type TextExtractionOutput,
} from '@app/shared';
import { summarizerAgent } from '../../agents/summarizer/agent';
import { createMockContext, type MockResponder } from '../../testing/mock-model';
import { segmentDocument } from '../information-extraction/segment';
import { summarizationStage } from './stage';

const canonical = Array.from(
  { length: 40 },
  (_, i) =>
    `Parágrafo ${i}. A jurisprudência consolidada desta Corte estabelece que o prazo de quinze dias úteis deve ser observado pelas partes interessadas no processo.`,
).join('\n\n');
const text: TextExtractionOutput = {
  sourceFormat: 'txt',
  canonicalText: canonical,
  pageMap: [{ page: 1, start: 0, end: canonical.length }],
  cleaningReport: { removed: [], charsBefore: canonical.length, charsAfter: canonical.length, removedByRule: [] },
  stats: { pages: 1, words: canonical.split(/\s+/).length, estimatedTokens: 2000 },
};
const evidence = {
  quote: 'quinze dias úteis',
  start: 0,
  end: 10,
  page: 1,
  sectionId: null,
  matchType: 'exact' as const,
  matchScore: 1,
};
const facts: Fact[] = [
  {
    id: 'F01',
    category: 'deadline',
    label: 'Prazo',
    value: { amount: 15, unit: 'days', businessDays: true, trigger: null },
    evidence: [evidence],
    confidence: 'high',
    status: 'confirmed',
    uncertaintyReasons: [],
  },
  {
    id: 'F02',
    category: 'monetary_value',
    label: 'Valor-incerto-XYZ',
    value: { amount: 100, currency: 'BRL', role: 'multa' },
    evidence: [{ ...evidence, start: null, end: null, page: null, matchType: 'not_found', matchScore: null }],
    confidence: 'low',
    status: 'uncertain',
    uncertaintyReasons: ['quote_not_found', 'low_confidence'],
  },
];
const info: InformationExtractionOutput = {
  classification: {
    documentType: 'court_decision',
    subtype: null,
    confidence: 'high',
    rationale: 'x',
    metadata: { issuer: 'STJ', identifier: null, date: null, judgingBody: null, rapporteur: null },
  },
  sections: segmentDocument(canonical, 'generic').sections,
  facts,
  notFound: [],
  ambiguities: [],
};
const input = { text, info };

const summary = (refs: string[] = ['F01']): Summary => ({
  title: 'Decisão sobre prazo',
  overview: 'O tribunal manteve o prazo. A decisão foi unânime.',
  sections: [{ heading: 'O que foi discutido', paragraphs: [{ text: 'O prazo é de 15 dias úteis.', factRefs: refs }] }],
  glossary: [{ term: 'Prazo', explanation: 'Tempo para agir.' }],
});
const ctxWith = (respond: MockResponder, config: object = {}) =>
  createMockContext([[summarizerAgent, respond]], { config: parsePipelineConfig(config) });

test('output has readability and compression', async () => {
  const ctx = ctxWith(() => summary());
  const out = await summarizationStage.run(input, ctx);
  expect(out.readability.summary).toBeTypeOf('number');
  expect(out.readability.source).toBeTypeOf('number');
  expect(out.compressionRatio).toBeGreaterThan(1);
  expect(out.summary.title).toBe('Decisão sobre prazo');
  expect(summarizationStage.output.parse(out)).toEqual(out);
  expect(ctx.calls).toHaveLength(1);
  expect(ctx.calls[0]!.prompt).toContain('O que o tribunal decidiu');
});

test('hedge mode sends uncertain facts marked as such', async () => {
  const ctx = ctxWith(() => summary());
  await summarizationStage.run(input, ctx);
  expect(ctx.calls[0]!.prompt).toContain('Valor-incerto-XYZ');
  expect(ctx.calls[0]!.prompt).toMatch(/F02.*uncertain/);
});

test('omit mode hides uncertain facts from the prompt', async () => {
  const ctx = ctxWith(() => summary(), { summarization: { uncertainFacts: 'omit' } });
  await summarizationStage.run(input, ctx);
  expect(ctx.calls[0]!.prompt).not.toContain('Valor-incerto-XYZ');
  expect(ctx.calls[0]!.prompt).toContain('Prazo');
});

test('unknown factRefs are dropped with a warning', async () => {
  const ctx = ctxWith(() => summary(['F01', 'F99']));
  const out = await summarizationStage.run(input, ctx);
  expect(out.summary.sections[0]!.paragraphs[0]!.factRefs).toEqual(['F01']);
  expect(ctx.emitted.warnings.map((w) => w.code)).toContain('summary_unknown_fact_refs');
});

test('hierarchical when text exceeds maxDirectTokens', async () => {
  const ctx = ctxWith(() => summary(), { summarization: { maxDirectTokens: 800 } });
  await summarizationStage.run(input, ctx);
  expect(ctx.calls.length).toBeGreaterThan(2);
  const finalPrompt = ctx.calls.at(-1)!.prompt;
  expect(finalPrompt).toContain('O tribunal manteve o prazo.');
  expect(ctx.emitted.warnings.map((w) => w.code)).toContain('summarization_auto_hierarchical');
});

test('useExtractedFacts false sends no facts', async () => {
  const ctx = ctxWith(() => summary([]), { summarization: { useExtractedFacts: false } });
  await summarizationStage.run(input, ctx);
  expect(ctx.calls[0]!.prompt).not.toContain('F01');
});

test('includeGlossary false empties glossary', async () => {
  const ctx = ctxWith(() => summary(), { summarization: { includeGlossary: false } });
  expect((await summarizationStage.run(input, ctx)).summary.glossary).toEqual([]);
});

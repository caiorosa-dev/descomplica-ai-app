import { type Classification, type ExtractorOutput, parsePipelineConfig } from '@app/shared';
import { createExtractorAgent } from '../../../agents/extractor';
import { createMockContext } from '../../../testing/mock-model';
import { segmentDocument } from '../segment';
import { callExtractors } from './call-extractors';

const empty: ExtractorOutput = { facts: [], notFound: [], ambiguities: [] };
const classification = (over: Partial<Classification> = {}): Classification => ({
  documentType: 'court_decision',
  subtype: null,
  confidence: 'high',
  rationale: 'x',
  metadata: { issuer: null, identifier: null, date: null, judgingBody: null, rapporteur: null },
  ...over,
});
const text = Array.from(
  { length: 12 },
  (_, i) => `Parágrafo ${i} com algumas palavras sobre o recurso especial e o prazo.`,
).join('\n\n');
const sections = segmentDocument(text, 'generic').sections;
const ctxWith = (config: object, type: Classification['documentType'] = 'court_decision') =>
  createMockContext([[createExtractorAgent(type), () => empty]], { config: parsePipelineConfig(config) });

test('single_pass unified → one call', async () => {
  const ctx = ctxWith({});
  const r = await callExtractors({ text, sections, classification: classification() }, ctx);
  expect(ctx.calls).toHaveLength(1);
  expect(ctx.calls[0]!.agent).toBe('extractor.court-decision');
  expect(r.strategyUsed).toBe('single_pass');
  expect(r.outputs).toHaveLength(1);
  expect(r.outputs[0]!.chunk).toEqual({ start: 0, end: text.length, text });
});

test('per_category → one call per non-empty group', async () => {
  const ctx = ctxWith({ extraction: { agentSplit: 'per_category', categories: ['date', 'deadline', 'decision'] } });
  await callExtractors({ text, sections, classification: classification() }, ctx);
  expect(ctx.calls).toHaveLength(2);
  expect(ctx.calls[0]!.prompt).toContain('date, deadline');
});

test('auto-chunks above maxSinglePassTokens and warns', async () => {
  const ctx = ctxWith({ extraction: { maxSinglePassTokens: 50, chunkTokens: 60, overlapTokens: 10 } });
  const r = await callExtractors({ text, sections, classification: classification() }, ctx);
  expect(r.strategyUsed).toBe('chunked');
  expect(ctx.calls.length).toBeGreaterThan(1);
  expect(ctx.emitted.warnings.map((w) => w.code)).toContain('extraction_auto_chunked');
  expect(ctx.emitted.progress.at(-1)).toMatch(/^Extraindo fatos: chamada \d+\/\d+$/);
});

test('chunked strategy by config does not warn', async () => {
  const ctx = ctxWith({ extraction: { strategy: 'chunked', chunkTokens: 60, overlapTokens: 10 } });
  expect((await callExtractors({ text, sections, classification: classification() }, ctx)).strategyUsed).toBe(
    'chunked',
  );
  expect(ctx.emitted.warnings).toEqual([]);
});

test('amendment subtype adds amendment category and uses the normative extractor', async () => {
  const ctx = ctxWith({}, 'normative_act');
  await callExtractors(
    { text, sections, classification: classification({ documentType: 'normative_act', subtype: 'amendment' }) },
    ctx,
  );
  expect(ctx.calls[0]!.agent).toBe('extractor.normative-act');
  expect(ctx.calls[0]!.prompt).toContain('amendment');
});

import { type Classification, parsePipelineConfig, type TextExtractionOutput } from '@app/shared';
import { classifierAgent } from '../../agents/classifier/agent';
import { createMockContext } from '../../testing/mock-model';
import { classifyDocument } from './classify';

const nullMeta = { issuer: null, identifier: null, date: null, judgingBody: null, rapporteur: null };
const textOutput = (canonicalText: string): TextExtractionOutput => ({
  sourceFormat: 'txt',
  canonicalText,
  pageMap: [{ page: 1, start: 0, end: canonicalText.length }],
  cleaningReport: {
    removed: [],
    charsBefore: canonicalText.length,
    charsAfter: canonicalText.length,
    removedByRule: [],
  },
  stats: { pages: 1, words: 3, estimatedTokens: 5 },
});
const ctxWithMock = (answer: Classification) => createMockContext([[classifierAgent, () => answer]]);

test('forced type overrides model output and low confidence warns', async () => {
  const ctx = ctxWithMock({
    documentType: 'generic',
    subtype: null,
    confidence: 'low',
    rationale: 'x',
    metadata: nullMeta,
  });
  ctx.config.classification.mode = 'normative_act';
  expect((await classifyDocument(textOutput('RESOLUÇÃO Nº 1'), ctx)).documentType).toBe('normative_act');
  expect(ctx.emitted.warnings.map((w) => w.code)).toContain('classification_low_confidence');
  expect(ctx.calls[0]!.prompt).toContain('normative_act');
});

test('auto mode keeps the model type, sends only the head of short texts', async () => {
  const ctx = ctxWithMock({
    documentType: 'court_decision',
    subtype: null,
    confidence: 'high',
    rationale: 'Acórdão',
    metadata: nullMeta,
  });
  const out = await classifyDocument(textOutput('RECURSO ESPECIAL Nº 1 EMENTA'), ctx);
  expect(out.documentType).toBe('court_decision');
  expect(ctx.emitted.warnings).toEqual([]);
  expect(ctx.calls[0]!.prompt).toContain('RECURSO ESPECIAL Nº 1 EMENTA');
});

test('long texts also send the tail', async () => {
  const long = `${'início '.repeat(6000)}FINAL-DO-DOCUMENTO`;
  const ctx = ctxWithMock({
    documentType: 'generic',
    subtype: null,
    confidence: 'high',
    rationale: 'x',
    metadata: nullMeta,
  });
  await classifyDocument(textOutput(long), ctx);
  expect(ctx.calls[0]!.prompt).toContain('FINAL-DO-DOCUMENTO');
});

test('amendment subtype is dropped for non-normative types', async () => {
  const ctx = createMockContext(
    [
      [
        classifierAgent,
        () => ({
          documentType: 'court_decision',
          subtype: 'amendment',
          confidence: 'high',
          rationale: 'x',
          metadata: nullMeta,
        }),
      ],
    ],
    { config: parsePipelineConfig({}) },
  );
  expect((await classifyDocument(textOutput('x'), ctx)).subtype).toBeNull();
});

import type { Classification, ExtractorOutput, TextExtractionOutput } from '@app/shared';
import { classifierAgent } from '../../agents/classifier/agent';
import { createExtractorAgent } from '../../agents/extractor';
import { createMockContext } from '../../testing/mock-model';
import { informationExtractionStage } from './stage';

const acordao = [
  'RECURSO ESPECIAL Nº 1.969.219 - SP (2021/0000000-0)',
  'EMENTA',
  'RECURSO ESPECIAL. DIREITO CIVIL. Prazo de 15 (quinze) dias úteis para a resposta.',
  'ACÓRDÃO',
  'Vistos, relatados e discutidos estes autos, acordam os Ministros da Quarta Turma, por unanimidade, negar provimento ao recurso especial.',
  'RELATÓRIO',
  'Trata-se de recurso especial interposto contra acórdão do Tribunal de Justiça.',
  'VOTO',
  'O recurso não merece prosperar.',
  'Ante o exposto, nego provimento ao recurso especial.',
  'CERTIDÃO DE JULGAMENTO',
  'Brasília, 24 de março de 2025.',
].join('\n\n');

const acordaoTextOutput: TextExtractionOutput = {
  sourceFormat: 'txt',
  canonicalText: acordao,
  pageMap: [{ page: 1, start: 0, end: acordao.length }],
  cleaningReport: { removed: [], charsBefore: acordao.length, charsAfter: acordao.length, removedByRule: [] },
  stats: { pages: 1, words: 80, estimatedTokens: 150 },
};

const courtDecision: Classification = {
  documentType: 'court_decision',
  subtype: null,
  confidence: 'high',
  rationale: 'Acórdão do STJ',
  metadata: {
    issuer: 'STJ',
    identifier: 'REsp 1.969.219/SP',
    date: '2025-03-24',
    judgingBody: 'Quarta Turma',
    rapporteur: null,
  },
};

const threeFactsOneInvented: ExtractorOutput = {
  facts: [
    {
      id: 'F01',
      category: 'deadline',
      label: 'Prazo para resposta',
      value: { amount: 15, unit: 'days', businessDays: true, trigger: null },
      evidence: [{ quote: '15 (quinze) dias úteis' }],
      confidence: 'high',
    },
    {
      id: 'F02',
      category: 'decision',
      label: 'Resultado',
      value: { outcome: 'denied', description: 'Recurso especial desprovido', unanimity: 'unanimous' },
      evidence: [{ quote: 'nego provimento ao recurso especial' }],
      confidence: 'high',
    },
    {
      id: 'F03',
      category: 'monetary_value',
      label: 'Indenização',
      value: { amount: 50000, currency: 'BRL', role: 'indenização' },
      evidence: [{ quote: 'condeno ao pagamento de R$ 50.000,00' }],
      confidence: 'high',
    },
  ],
  notFound: ['obligation'],
  ambiguities: [],
};

const ctxWithMocks = (m: { classifier: Classification; extractor: ExtractorOutput }) =>
  createMockContext([
    [classifierAgent, () => m.classifier],
    [createExtractorAgent('court_decision'), () => m.extractor],
  ]);

test('stage end-to-end with mocks flags invented quote', async () => {
  const ctx = ctxWithMocks({ classifier: courtDecision, extractor: threeFactsOneInvented });
  const out = await informationExtractionStage.run({ text: acordaoTextOutput }, ctx);
  expect(out.facts).toHaveLength(3);
  expect(out.facts.filter((f) => f.uncertaintyReasons.includes('quote_not_found'))).toHaveLength(1);
  expect(out.sections.length).toBeGreaterThan(0);
  expect(out.classification.documentType).toBe('court_decision');
  const decision = out.facts.find((f) => f.category === 'decision')!;
  expect(decision.status).toBe('confirmed');
  expect(decision.evidence[0]).toMatchObject({ matchType: 'exact', page: 1 });
  expect(out.sections.find((s) => s.id === decision.evidence[0]!.sectionId)?.kind).toBe('operative_part');
  expect(out.notFound).toEqual(['obligation']);
  expect(informationExtractionStage.output.parse(out)).toEqual(out);
});

test('segmentation fallback warns', async () => {
  const text = { ...acordaoTextOutput, canonicalText: 'Um parágrafo qualquer.\n\nOutro parágrafo.' };
  const ctx = ctxWithMocks({ classifier: courtDecision, extractor: { facts: [], notFound: [], ambiguities: [] } });
  const out = await informationExtractionStage.run({ text }, ctx);
  expect(ctx.emitted.warnings.map((w) => w.code)).toContain('segmentation_fallback');
  expect(out.sections.every((s) => s.kind === 'paragraph')).toBe(true);
});

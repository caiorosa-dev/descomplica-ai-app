import {
  claimExtractorAgent,
  classifierAgent,
  cleanerAgent,
  createExtractorAgent,
  summarizerAgent,
  verifierAgent,
} from '@app/pipeline';
import { createAgentMockModel, createFakeEmbedder, type MockCall, type MockResponder } from '@app/pipeline/testing';
import type { AiOverrides } from '../../src/app';
import type { EmbedManyFn } from '../../src/runtime/adapters/embedder';

export const ACORDAO_TXT = [
  'RECURSO ESPECIAL Nº 1.969.219 - SP',
  'EMENTA',
  'RECURSO ESPECIAL. DIREITO CIVIL. Prazo de 15 (quinze) dias úteis para a resposta.',
  'ACÓRDÃO',
  'Vistos e relatados estes autos, acordam os Ministros da Quarta Turma, por unanimidade, negar provimento ao recurso especial.',
  'RELATÓRIO',
  'Trata-se de recurso especial interposto contra acórdão do Tribunal de Justiça.',
  'VOTO',
  'O recurso não merece prosperar.',
  'Ante o exposto, nego provimento ao recurso especial.',
  'CERTIDÃO DE JULGAMENTO',
  'Brasília, 24 de março de 2025.',
].join('\n\n');

const meta = {
  issuer: 'STJ',
  identifier: 'REsp 1.969.219/SP',
  date: '2025-03-24',
  judgingBody: 'Quarta Turma',
  rapporteur: null,
};

export const DEFAULT_RESPONDERS: Record<string, MockResponder> = {
  cleaner: () => ({ removeLineIds: [], reasons: [] }),
  classifier: () => ({
    documentType: 'court_decision',
    subtype: null,
    confidence: 'high',
    rationale: 'Acórdão do STJ',
    metadata: meta,
  }),
  extractor: () => ({
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
        label: 'Resultado do julgamento',
        value: { outcome: 'denied', description: 'Recurso especial desprovido', unanimity: 'unanimous' },
        evidence: [{ quote: 'nego provimento ao recurso especial' }],
        confidence: 'high',
      },
      {
        id: 'F03',
        category: 'date',
        label: 'Data do julgamento',
        value: { iso: '2025-03-24', role: 'judgment' },
        evidence: [{ quote: '24 de março de 2025' }],
        confidence: 'high',
      },
    ],
    notFound: ['monetary_value'],
    ambiguities: [],
  }),
  summarizer: () => ({
    title: 'STJ mantém decisão',
    overview: 'O tribunal negou o recurso. A decisão foi unânime.',
    sections: [
      {
        heading: 'O que foi discutido',
        paragraphs: [{ text: 'O prazo para resposta é de 15 dias úteis.', factRefs: ['F01'] }],
      },
      {
        heading: 'O que o tribunal decidiu',
        paragraphs: [{ text: 'O tribunal negou provimento ao recurso.', factRefs: ['F02'] }],
      },
    ],
    glossary: [{ term: 'Recurso especial', explanation: 'Pedido ao STJ para rever uma decisão.' }],
  }),
  'claim-extractor': () => ({
    claims: [
      {
        text: 'O prazo para resposta é de 15 dias úteis.',
        paragraphIndexInInput: 1,
        category: 'deadline',
        value: { amount: 15, unit: 'days', businessDays: true, trigger: null },
      },
      { text: 'O tribunal negou provimento ao recurso.', paragraphIndexInInput: 2, category: 'untyped', value: null },
    ],
  }),
  verifier: ({ prompt }) => ({
    verdicts: [...prompt.matchAll(/itemId: (V\d+)\ndirection: (\w+)/g)].map((m) => ({
      itemId: m[1],
      verdict: m[2] === 'source_to_summary' ? 'consistent' : 'supported',
      explanation: 'Confere com o documento.',
      usedQuotes: [],
    })),
  }),
};

/** Agent-routed mock models plus a deterministic embedder, injected through buildApp({ ai }). */
export function createMockAi(overrides: Record<string, MockResponder> = {}) {
  const r = { ...DEFAULT_RESPONDERS, ...overrides };
  const calls: MockCall[] = [];
  const { model } = createAgentMockModel(
    [
      [cleanerAgent, r.cleaner!],
      [classifierAgent, r.classifier!],
      [createExtractorAgent('court_decision'), r.extractor!],
      [createExtractorAgent('normative_act'), r.extractor!],
      [createExtractorAgent('generic'), r.extractor!],
      [summarizerAgent, r.summarizer!],
      [claimExtractorAgent, r['claim-extractor']!],
      [verifierAgent, r.verifier!],
    ],
    calls,
  );
  const fake = createFakeEmbedder(32);
  const embedManyFn: EmbedManyFn = async ({ model: m, values, dimensions }) => ({
    embeddings: await fake.embed(values, { model: m, dimensions }),
    tokens: values.length,
  });
  const ai: AiOverrides = { modelResolver: { resolve: () => model }, embedManyFn };
  return { ai, calls, mockCalls: (agent: string) => calls.filter((c) => c.agent === agent).length };
}

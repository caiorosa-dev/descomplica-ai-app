import type {
  InformationExtractionOutput,
  RunMetricsShape,
  SummarizationOutput,
  VerificationOutput,
} from '@app/shared';
import { effectiveStageRunId, loadStageOutputs } from '../src/runtime/persistence/load-outputs';
import { materializeStageOutput } from '../src/runtime/persistence/materialize';
import { resetDatabase, testPrisma } from './helpers/db';
import { createRunRow } from './helpers/fixtures';

const prisma = testPrisma();
const ev = (quote: string, start: number | null) => ({
  quote,
  start,
  end: start === null ? null : start + quote.length,
  page: start === null ? null : 1,
  sectionId: start === null ? null : 'S01',
  matchType: start === null ? ('not_found' as const) : ('exact' as const),
  matchScore: start === null ? null : 1,
});
const infoFixture: InformationExtractionOutput = {
  classification: {
    documentType: 'court_decision',
    subtype: null,
    confidence: 'high',
    rationale: 'x',
    metadata: { issuer: 'STJ', identifier: null, date: null, judgingBody: null, rapporteur: null },
  },
  sections: [{ id: 'S01', kind: 'paragraph', label: 'Parágrafo 1', parentLabel: null, start: 0, end: 100 }],
  facts: [
    {
      id: 'F01',
      category: 'deadline',
      label: 'Prazo',
      value: { amount: 15, unit: 'days', businessDays: true, trigger: null },
      evidence: [ev('15 dias úteis', 10), ev('quinze dias', 40)],
      confidence: 'high',
      status: 'confirmed',
      uncertaintyReasons: [],
    },
    {
      id: 'F02',
      category: 'monetary_value',
      label: 'Valor',
      value: { amount: 100, currency: 'BRL', role: 'multa' },
      evidence: [ev('R$ 100', null)],
      confidence: 'low',
      status: 'uncertain',
      uncertaintyReasons: ['quote_not_found', 'low_confidence'],
    },
  ],
  notFound: [],
  ambiguities: [],
};
const verificationFixture: VerificationOutput = {
  claims: [
    {
      id: 'A01',
      text: 'O prazo é de 30 dias.',
      paragraphRef: { sectionIndex: 0, paragraphIndex: 0 },
      category: 'deadline',
      value: { amount: 30, unit: 'days', businessDays: null, trigger: null },
    },
    { id: 'A02', text: 'Em resumo, o recurso foi negado.', paragraphRef: null, category: null, value: null },
  ],
  items: [
    {
      id: 'V001',
      direction: 'summary_to_source',
      verdict: 'divergent',
      explanation: 'diverge',
      factId: 'F01',
      claimId: 'A01',
      decidedBy: 'llm',
      usedQuotes: ['15 dias úteis'],
    },
    {
      id: 'V002',
      direction: 'source_to_summary',
      verdict: 'unverifiable',
      explanation: 'incerto',
      factId: 'F02',
      claimId: null,
      decidedBy: 'code',
      usedQuotes: [],
    },
  ],
  alerts: [
    {
      id: 'AL01',
      type: 'divergence',
      severity: 'high',
      category: 'deadline',
      title: 'Divergência em Prazo',
      explanation: 'diverge',
      sourceFactId: 'F01',
      claimId: 'A01',
      verificationItemId: 'V001',
      sourceEvidence: [{ start: 10, end: 23, page: 1 }],
      summaryRef: { sectionIndex: 0, paragraphIndex: 0 },
    },
  ],
  metrics: { factualConsistency: 0, claimSupport: 0, unverifiableCount: 1 },
};
const summarizationFixture: SummarizationOutput = {
  summary: { title: 't', overview: 'o', sections: [], glossary: [] },
  readability: { source: 40, summary: 60 },
  compressionRatio: 5,
};
const metricsFixture: RunMetricsShape = {
  centroid: 0.9,
  coverage: 0.8,
  support: 0.7,
  alignmentF1: 0.75,
  factualConsistency: null,
  claimSupport: 0.5,
  unverifiableCount: 1,
  factsConfirmed: 1,
  factsUncertain: 1,
  alertsHigh: 1,
  alertsMedium: 0,
  alertsLow: 0,
  readabilitySource: 40,
  readabilitySummary: 60,
  compressionRatio: 5,
  inputTokens: 100,
  outputTokens: 50,
  costUsd: 0.01,
  durationMs: 1000,
};

let runId: string;
const stageRun = (
  stage: 'information_extraction' | 'summarization' | 'verification' | 'report',
  output: unknown,
  extra = {},
) => prisma.stageRun.create({ data: { runId, stage, status: 'completed', output: output as object, ...extra } });

beforeEach(async () => {
  await resetDatabase(prisma);
  runId = (await createRunRow(prisma)).id;
});

test('information_extraction → facts and evidence rows', async () => {
  const sr = await stageRun('information_extraction', infoFixture);
  await prisma.$transaction((tx) =>
    materializeStageOutput(tx, { runId, stageRunId: sr.id, stage: 'information_extraction', output: infoFixture }),
  );
  const facts = await prisma.extractedFact.findMany({
    where: { stageRunId: sr.id },
    orderBy: { key: 'asc' },
    include: { evidence: { orderBy: { position: 'asc' } } },
  });
  expect(facts).toHaveLength(infoFixture.facts.length);
  expect(await prisma.factEvidence.count()).toBe(infoFixture.facts.flatMap((f) => f.evidence).length);
  expect(facts[0]).toMatchObject({ key: 'F01', category: 'deadline', status: 'confirmed', uncertaintyReasons: [] });
  expect(facts[0]!.evidence.map((e) => [e.quote, e.start, e.matchType])).toEqual([
    ['15 dias úteis', 10, 'exact'],
    ['quinze dias', 40, 'exact'],
  ]);
  expect(facts[1]!.uncertaintyReasons).toEqual(['quote_not_found', 'low_confidence']);
});

test('verification → alert → item → claim links', async () => {
  const info = await stageRun('information_extraction', infoFixture);
  await prisma.$transaction((tx) =>
    materializeStageOutput(tx, { runId, stageRunId: info.id, stage: 'information_extraction', output: infoFixture }),
  );
  const ver = await stageRun('verification', verificationFixture);
  await prisma.$transaction((tx) =>
    materializeStageOutput(tx, { runId, stageRunId: ver.id, stage: 'verification', output: verificationFixture }),
  );
  const alert = await prisma.alert.findFirstOrThrow({
    where: { stageRunId: ver.id },
    include: { verificationItem: { include: { claim: true, fact: true } } },
  });
  expect(alert).toMatchObject({ key: 'AL01', type: 'divergence', severity: 'high' });
  expect(alert.verificationItem).toMatchObject({ key: 'V001', verdict: 'divergent', decidedBy: 'llm' });
  expect(alert.verificationItem.claim?.key).toBe('A01');
  expect(alert.verificationItem.fact?.key).toBe('F01');
  const unverifiable = await prisma.verificationItem.findFirstOrThrow({
    where: { key: 'V002' },
    include: { fact: true },
  });
  expect(unverifiable.fact?.key).toBe('F02');
  expect(unverifiable.claimId).toBeNull();
  const overview = await prisma.claim.findFirstOrThrow({ where: { key: 'A02' } });
  expect(overview.paragraphRef).toBeNull();
  expect(overview.value).toBeNull();
});

test('summarization and report rows', async () => {
  const sum = await stageRun('summarization', summarizationFixture);
  await prisma.$transaction((tx) =>
    materializeStageOutput(tx, { runId, stageRunId: sum.id, stage: 'summarization', output: summarizationFixture }),
  );
  expect(await prisma.summary.findUniqueOrThrow({ where: { stageRunId: sum.id } })).toMatchObject({
    compressionRatio: 5,
    readabilitySummary: 60,
  });
  const rep = await stageRun('report', metricsFixture);
  await prisma.$transaction((tx) =>
    materializeStageOutput(tx, { runId, stageRunId: rep.id, stage: 'report', output: metricsFixture }),
  );
  await prisma.$transaction((tx) =>
    materializeStageOutput(tx, {
      runId,
      stageRunId: rep.id,
      stage: 'report',
      output: { ...metricsFixture, costUsd: 0.02 },
    }),
  );
  expect(await prisma.runMetrics.findUniqueOrThrow({ where: { runId } })).toMatchObject({
    alignmentF1: 0.75,
    factualConsistency: null,
    costUsd: 0.02,
  });
});

test('reused stage run loads origin output', async () => {
  const a = await stageRun('information_extraction', infoFixture);
  const runB = await createRunRow(prisma);
  const b = await prisma.stageRun.create({
    data: { runId: runB.id, stage: 'information_extraction', status: 'reused', reusedFromStageRunId: a.id },
  });
  expect(effectiveStageRunId(b)).toBe(a.id);
  expect(effectiveStageRunId(a)).toBe(a.id);
  const outputs = await loadStageOutputs(prisma, runB.id);
  expect(outputs.information_extraction).toEqual(infoFixture);
  expect(outputs.text_extraction).toBeUndefined();
});

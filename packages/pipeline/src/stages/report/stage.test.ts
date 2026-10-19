import type { Alert, Fact } from '@app/shared';
import { createTestContext } from '../../testing/context';
import { STAGES_BY_NAME } from '../index';
import { type ReportInput, reportStage } from './stage';

const fact = (id: string, status: 'confirmed' | 'uncertain'): Fact =>
  ({
    id,
    category: 'date',
    label: id,
    value: { iso: '2025-01-01', role: 'other' },
    evidence: [],
    confidence: 'high',
    status,
    uncertaintyReasons: [],
  }) as unknown as Fact;
const alert = (id: string, severity: Alert['severity']): Alert => ({
  id,
  type: 'divergence',
  severity,
  category: 'deadline',
  title: 't',
  explanation: 'e',
  sourceFactId: null,
  claimId: null,
  sourceEvidence: [],
  summaryRef: null,
});

const fixture: ReportInput = {
  info: {
    classification: {
      documentType: 'generic',
      subtype: null,
      confidence: 'high',
      rationale: 'x',
      metadata: { issuer: null, identifier: null, date: null, judgingBody: null, rapporteur: null },
    },
    sections: [],
    facts: [fact('F01', 'confirmed'), fact('F02', 'confirmed'), fact('F03', 'uncertain')],
    notFound: [],
    ambiguities: [],
  },
  summarization: {
    summary: { title: 't', overview: 'o', sections: [], glossary: [] },
    readability: { source: 30.5, summary: 62.1 },
    compressionRatio: 7.5,
  },
  similarity: {
    sourceChunks: [],
    summaryChunks: [],
    metrics: { centroid: 0.91, coverage: 0.7, support: 0.8, alignmentF1: 0.746 },
    headline: { metric: 'alignment_f1', value: 0.746 },
    coverageByChunk: [],
    supportByParagraph: [],
  },
  verification: {
    claims: [],
    items: [],
    alerts: [alert('AL01', 'high'), alert('AL02', 'low'), alert('AL03', 'low')],
    metrics: { factualConsistency: 0.75, claimSupport: 0.9, unverifiableCount: 2 },
  },
  totals: { inputTokens: 12000, outputTokens: 3400, costUsd: 0.12, durationMs: 45000 },
};

test('aggregates metrics', async () => {
  const m = await reportStage.run(fixture, createTestContext());
  expect(m).toEqual({
    centroid: 0.91,
    coverage: 0.7,
    support: 0.8,
    alignmentF1: 0.746,
    factualConsistency: 0.75,
    claimSupport: 0.9,
    unverifiableCount: 2,
    factsConfirmed: 2,
    factsUncertain: 1,
    alertsHigh: 1,
    alertsMedium: 0,
    alertsLow: 2,
    readabilitySource: 30.5,
    readabilitySummary: 62.1,
    compressionRatio: 7.5,
    inputTokens: 12000,
    outputTokens: 3400,
    costUsd: 0.12,
    durationMs: 45000,
  });
});

test('propagates null metrics without NaN (Review Focus 3)', async () => {
  const m = await reportStage.run(
    {
      ...fixture,
      verification: {
        ...fixture.verification,
        metrics: { factualConsistency: null, claimSupport: null, unverifiableCount: 0 },
      },
    },
    createTestContext(),
  );
  expect(m.factualConsistency).toBeNull();
  expect(Object.values(m).some((v) => Number.isNaN(v))).toBe(false);
});

test('NaN inputs become null', async () => {
  const m = await reportStage.run(
    { ...fixture, summarization: { ...fixture.summarization, compressionRatio: Number.NaN } },
    createTestContext(),
  );
  expect(m.compressionRatio).toBeNull();
});

test('STAGES_BY_NAME has the six stages in order', () =>
  expect(Object.keys(STAGES_BY_NAME)).toEqual([
    'text_extraction',
    'information_extraction',
    'summarization',
    'similarity',
    'verification',
    'report',
  ]));

import type { Confidence, GroundedEvidence, GroundedFactDraft } from '@app/shared';
import type { GroundedExtractorOutput } from './extract/merge';
import { finalizeFacts } from './postprocess';

interface FactOpts {
  anchored: boolean;
  quote?: string;
  iso?: string;
  confidence?: Confidence;
  start?: number;
  end?: number;
  ambiguityAt?: [number, number];
}

const ev = (o: FactOpts): GroundedEvidence => ({
  quote: o.quote ?? 'em 24/03/2025',
  start: o.anchored ? (o.start ?? 0) : null,
  end: o.anchored ? (o.end ?? 13) : null,
  page: o.anchored ? 1 : null,
  sectionId: null,
  matchType: o.anchored ? 'exact' : 'not_found',
  matchScore: o.anchored ? 1 : null,
});

const wrap = (f: GroundedFactDraft, o: FactOpts): GroundedExtractorOutput => ({
  facts: [f],
  notFound: [],
  ambiguities: o.ambiguityAt
    ? [
        {
          description: 'dúvida',
          quote: 'trecho',
          match: {
            start: o.ambiguityAt[0],
            end: o.ambiguityAt[1],
            page: 1,
            sectionId: null,
            matchType: 'exact',
            matchScore: 1,
          },
        },
      ]
    : [],
});

const fact = (o: FactOpts) =>
  wrap(
    {
      id: 'F01',
      category: 'date',
      label: 'Data do julgamento',
      value: { iso: o.iso ?? '2025-03-24', role: 'judgment' },
      evidence: [ev(o)],
      confidence: o.confidence ?? 'high',
    },
    o,
  );

const obligationFact = (o: FactOpts) =>
  wrap(
    {
      id: 'F01',
      category: 'obligation',
      label: 'Obrigação',
      value: { bearer: 'os tribunais', action: 'publicar', modality: 'must', condition: null },
      evidence: [ev({ ...o, quote: 'os tribunais deverão publicar' })],
      confidence: 'high',
    },
    o,
  );

test.each([
  [
    'anchored, value ok, high',
    fact({ anchored: true, quote: 'em 24/03/2025', iso: '2025-03-24', confidence: 'high' }),
    [],
  ],
  ['no evidence anchored', fact({ anchored: false }), ['quote_not_found']],
  ['value mismatch', fact({ anchored: true, quote: 'em 25/03/2025', iso: '2025-03-24' }), ['value_mismatch']],
  ['low confidence', fact({ anchored: true, confidence: 'low' }), ['low_confidence']],
  ['overlaps ambiguity', fact({ anchored: true, start: 10, end: 30, ambiguityAt: [20, 40] }), ['ambiguous']],
  ['ambiguity elsewhere', fact({ anchored: true, start: 10, end: 30, ambiguityAt: [30, 40] }), []],
  ['obligation has no parser', obligationFact({ anchored: true }), []],
])('%s', (_, merged, reasons) => {
  const [f] = finalizeFacts(merged, 'medium');
  expect(f!.uncertaintyReasons).toEqual(reasons);
  expect(f!.status).toBe(reasons.length ? 'uncertain' : 'confirmed');
});

test('value checked only against anchored evidence; one match is enough', () => {
  const merged = fact({ anchored: true, quote: 'em 24/03/2025' });
  merged.facts[0]!.evidence.push(ev({ anchored: true, quote: 'em 30/04/2025', start: 50, end: 63 }));
  merged.facts[0]!.evidence.push(ev({ anchored: false, quote: 'em 01/01/2020' }));
  expect(finalizeFacts(merged, 'medium')[0]!.uncertaintyReasons).toEqual([]);
});

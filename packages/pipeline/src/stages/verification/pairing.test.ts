import type { Claim, Fact, Summary } from '@app/shared';
import { pairClaims, type Retrieved } from './pairing';

const ev = { quote: 'q', start: 0, end: 1, page: 1, sectionId: null, matchType: 'exact' as const, matchScore: 1 };
const deadline = (id: string, amount: number): Fact => ({
  id,
  category: 'deadline',
  label: `Prazo ${id}`,
  value: { amount, unit: 'days', businessDays: null, trigger: null },
  evidence: [ev],
  confidence: 'high',
  status: 'confirmed',
  uncertaintyReasons: [],
});
const decision: Fact = {
  id: 'F03',
  category: 'decision',
  label: 'Resultado',
  value: { outcome: 'denied', description: 'x', unanimity: 'unknown' },
  evidence: [ev],
  confidence: 'high',
  status: 'confirmed',
  uncertaintyReasons: [],
};
const facts = [deadline('F01', 15), deadline('F02', 30), decision, deadline('F04', 15)];
const summary: Summary = {
  title: 't',
  overview: 'o',
  sections: [{ heading: 'h', paragraphs: [{ text: 'p', factRefs: ['F03', 'F04'] }] }],
  glossary: [],
};
const claim15: Claim = {
  id: 'A01',
  text: 'O prazo é de 15 dias.',
  paragraphRef: { sectionIndex: 0, paragraphIndex: 0 },
  category: 'deadline',
  value: { amount: 15, unit: 'days', businessDays: null, trigger: null },
};
const overviewClaim: Claim = { id: 'A02', text: 'Resumo.', paragraphRef: null, category: null, value: null };

test('pairing order: factRefs first, then same-category compatible, deduped; chunks attached', async () => {
  const chunk = (id: string, score: number): Retrieved => ({ chunkId: id, start: 0, end: 10, score });
  const retrieve = async (texts: string[]) =>
    texts.map(() => [chunk('C001', 0.9), chunk('C002', 0.8), chunk('C003', 0.7), chunk('C004', 0.6)]);
  const pairings = await pairClaims([claim15, overviewClaim], facts, summary, retrieve, 3);
  expect(pairings[0]!.candidateFacts.map((f) => f.id)).toEqual(['F03', 'F04', 'F01']);
  expect(pairings[0]!.chunks.map((c) => c.chunkId)).toEqual(['C001', 'C002', 'C003']);
  expect(pairings[1]!.candidateFacts).toEqual([]);
  expect(pairings[1]!.claim).toBe(overviewClaim);
});

test('retrieve is called once with every claim text', async () => {
  const seen: string[][] = [];
  await pairClaims(
    [claim15, overviewClaim],
    facts,
    summary,
    async (texts) => {
      seen.push(texts);
      return texts.map(() => []);
    },
    3,
  );
  expect(seen).toEqual([['O prazo é de 15 dias.', 'Resumo.']]);
});

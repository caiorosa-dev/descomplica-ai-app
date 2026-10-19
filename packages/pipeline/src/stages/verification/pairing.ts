import type { Claim, Fact, Summary } from '@app/shared';
import { compareValues } from './compare';

export interface Retrieved {
  chunkId: string;
  start: number;
  end: number;
  score: number;
}

export interface Pairing {
  claim: Claim;
  candidateFacts: Fact[];
  chunks: Retrieved[];
}

/**
 * Candidates per claim, in priority order and without duplicates: facts cited by the claim's paragraph, then facts
 * of the same category whose value is not different; plus the top-K most similar source chunks.
 */
export async function pairClaims(
  claims: Claim[],
  facts: Fact[],
  summary: Summary,
  retrieve: (texts: string[]) => Promise<Retrieved[][]>,
  topK: number,
): Promise<Pairing[]> {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const retrieved = claims.length > 0 ? await retrieve(claims.map((c) => c.text)) : [];
  return claims.map((claim, i) => {
    const candidates: Fact[] = [];
    const add = (fact: Fact | undefined) => {
      if (fact && !candidates.includes(fact)) candidates.push(fact);
    };
    const ref = claim.paragraphRef;
    if (ref)
      for (const id of summary.sections[ref.sectionIndex]?.paragraphs[ref.paragraphIndex]?.factRefs ?? [])
        add(byId.get(id));
    if (claim.category && claim.value)
      for (const fact of facts)
        if (fact.category === claim.category && compareValues(fact.category, claim.value, fact.value) !== 'different')
          add(fact);
    return { claim, candidateFacts: candidates, chunks: (retrieved[i] ?? []).slice(0, topK) };
  });
}

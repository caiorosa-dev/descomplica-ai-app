import { type Confidence, confidenceRank, type Fact, type UncertaintyReason } from '@app/shared';
import type { GroundedExtractorOutput } from './extract/merge';
import { valueAppearsIn } from './parsers/value-check';

/**
 * Status of each merged fact (spec §6.2, step 3): confirmed only when anchored, value checked and confident
 * enough; otherwise uncertain with every reason that applies.
 */
export function finalizeFacts(merged: GroundedExtractorOutput, minConfidence: Confidence): Fact[] {
  const ambiguitySpans = merged.ambiguities
    .filter((a) => a.match.start !== null && a.match.end !== null)
    .map((a) => ({ start: a.match.start as number, end: a.match.end as number }));
  return merged.facts.map((fact) => {
    const anchored = fact.evidence.filter((e) => e.start !== null && e.end !== null);
    const reasons: UncertaintyReason[] = [];
    if (anchored.length === 0) reasons.push('quote_not_found');
    else if (anchored.every((e) => valueAppearsIn(fact.category, fact.value, e.quote) === false))
      reasons.push('value_mismatch');
    if (confidenceRank(fact.confidence) < confidenceRank(minConfidence)) reasons.push('low_confidence');
    const overlapsAmbiguity = anchored.some((e) =>
      ambiguitySpans.some((a) => (e.start as number) < a.end && a.start < (e.end as number)),
    );
    if (overlapsAmbiguity) reasons.push('ambiguous');
    return { ...fact, status: reasons.length ? 'uncertain' : 'confirmed', uncertaintyReasons: reasons } as Fact;
  });
}

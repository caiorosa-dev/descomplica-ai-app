import type { Fact, FactCategory, VerificationItem, VerificationOutput } from '@app/shared';

/**
 * factualConsistency = consistent ÷ (consistent + divergent + omitted) over critical facts; claimSupport =
 * supported ÷ claims; unverifiable items stay out of both denominators. Zero denominators give null.
 */
export function computeVerificationMetrics(
  items: VerificationItem[],
  facts: Fact[],
  critical: FactCategory[],
): VerificationOutput['metrics'] {
  const categoryOf = new Map(facts.map((f) => [f.id, f.category]));
  const factItems = items.filter(
    (i) =>
      i.direction === 'source_to_summary' && i.factId && critical.includes(categoryOf.get(i.factId) as FactCategory),
  );
  const consistent = factItems.filter((i) => i.verdict === 'consistent').length;
  const judgedFacts = factItems.filter((i) => ['consistent', 'divergent', 'omitted'].includes(i.verdict)).length;
  const claimItems = items.filter((i) => i.direction === 'summary_to_source' && i.verdict !== 'unverifiable');
  const supported = claimItems.filter((i) => i.verdict === 'supported').length;
  return {
    factualConsistency: judgedFacts > 0 ? consistent / judgedFacts : null,
    claimSupport: claimItems.length > 0 ? supported / claimItems.length : null,
    unverifiableCount: items.filter((i) => i.verdict === 'unverifiable').length,
  };
}

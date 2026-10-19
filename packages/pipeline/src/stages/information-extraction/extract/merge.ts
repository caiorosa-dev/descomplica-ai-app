import {
  type CategoryValue,
  type Confidence,
  confidenceRank,
  type FactCategory,
  type GroundedFactDraft,
  type ValueOf,
} from '@app/shared';
import type { GroundingMatch } from '../grounding/ground-quote';
import { normalizeQuote } from '../grounding/normalize';

export interface GroundedExtractorOutput {
  facts: GroundedFactDraft[];
  notFound: FactCategory[];
  ambiguities: { description: string; quote: string; match: GroundingMatch }[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Normalized identity of a fact value, used to merge duplicates across chunks and category groups. */
export function valueKey(category: FactCategory, value: CategoryValue): string {
  switch (category) {
    case 'date': {
      const v = value as ValueOf<'date'>;
      return `${v.iso}|${v.role}`;
    }
    case 'deadline': {
      const v = value as ValueOf<'deadline'>;
      return `${v.amount}|${v.unit}|${v.businessDays}`;
    }
    case 'monetary_value':
      return (value as ValueOf<'monetary_value'>).amount.toFixed(2);
    case 'legal_reference':
      return (value as ValueOf<'legal_reference'>).citation.toLowerCase().replace(/\s+/g, '');
    case 'obligation': {
      const v = value as ValueOf<'obligation'>;
      return `${norm(v.bearer)}|${norm(v.action)}`;
    }
    case 'decision':
      return (value as ValueOf<'decision'>).outcome;
    case 'amendment': {
      const v = value as ValueOf<'amendment'>;
      return `${norm(v.targetProvision)}|${v.changeType}`;
    }
  }
}

function anchored(fact: GroundedFactDraft) {
  return fact.evidence.filter((e) => e.start !== null && e.end !== null) as {
    start: number;
    end: number;
    quote: string;
  }[];
}

function sameFact(a: GroundedFactDraft, b: GroundedFactDraft): boolean {
  if (a.category !== b.category || valueKey(a.category, a.value) !== valueKey(b.category, b.value)) return false;
  const spansA = anchored(a);
  const spansB = anchored(b);
  if (spansA.some((x) => spansB.some((y) => x.start < y.end && y.start < x.end))) return true;
  if (spansA.length === 0 && spansB.length === 0) {
    const quotes = new Set(a.evidence.map((e) => normalizeQuote(e.quote)));
    return b.evidence.some((e) => quotes.has(normalizeQuote(e.quote)));
  }
  return false;
}

function maxConfidence(a: Confidence, b: Confidence): Confidence {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

/**
 * Merges facts that share category, normalized value and overlapping evidence (or, when neither is anchored,
 * the same quote), keeping every unique quote and the highest confidence; ids are reassigned in text order.
 */
export function mergeFacts(outputs: GroundedExtractorOutput[]): GroundedExtractorOutput {
  const merged: GroundedFactDraft[] = [];
  for (const fact of outputs.flatMap((o) => o.facts)) {
    const existing = merged.find((m) => sameFact(m, fact));
    if (!existing) {
      merged.push({ ...fact, evidence: [...fact.evidence] });
      continue;
    }
    existing.confidence = maxConfidence(existing.confidence, fact.confidence);
    for (const e of fact.evidence)
      if (!existing.evidence.some((x) => normalizeQuote(x.quote) === normalizeQuote(e.quote)))
        existing.evidence.push(e);
  }

  const firstStart = (f: GroundedFactDraft) => Math.min(...anchored(f).map((e) => e.start), Number.POSITIVE_INFINITY);
  const ordered = merged
    .map((fact, order) => ({ fact, order }))
    .sort((a, b) => firstStart(a.fact) - firstStart(b.fact) || a.order - b.order)
    .map(({ fact }, i) => ({ ...fact, id: `F${String(i + 1).padStart(2, '0')}` }));

  const withFacts = new Set(ordered.map((f) => f.category));
  const notFound = [...new Set(outputs.flatMap((o) => o.notFound))].filter((c) => !withFacts.has(c));

  const ambiguities: GroundedExtractorOutput['ambiguities'] = [];
  for (const a of outputs.flatMap((o) => o.ambiguities))
    if (!ambiguities.some((x) => normalizeQuote(x.quote) === normalizeQuote(a.quote))) ambiguities.push(a);

  return { facts: ordered as GroundedFactDraft[], notFound, ambiguities };
}

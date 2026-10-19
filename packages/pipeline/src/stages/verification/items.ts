import type { Chunk, Claim, Direction, Fact, Summary, ValueOf, VerificationItem } from '@app/shared';
import { summaryPlainText } from '../../agents/summarizer/headings';
import type { VerifierItemInput } from '../../agents/verifier/agent';
import { compareValues } from './compare';
import {
  CHANGE_LABELS,
  DATE_ROLE_LABELS,
  MODALITY_LABELS,
  OUTCOME_LABELS,
  UNCERTAINTY_LABELS,
  UNIT_LABELS,
} from './labels';
import type { Pairing } from './pairing';

const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatValue(fact: Fact): string {
  switch (fact.category) {
    case 'date': {
      const [y, m, d] = fact.value.iso.split('-');
      return `${d}/${m}/${y} (${DATE_ROLE_LABELS[fact.value.role]})`;
    }
    case 'deadline': {
      const v: ValueOf<'deadline'> = fact.value;
      const unit = UNIT_LABELS[v.unit][v.amount === 1 ? 0 : 1];
      const kind = v.businessDays === true ? ' úteis' : v.businessDays === false ? ' corridos' : '';
      return `${v.amount} ${unit}${kind}${v.trigger ? `, a partir de ${v.trigger}` : ''}`;
    }
    case 'monetary_value':
      return `R$ ${brl.format(fact.value.amount)}`;
    case 'obligation': {
      const v = fact.value;
      return `${v.bearer} ${MODALITY_LABELS[v.modality]} ${v.action}${v.condition ? ` (${v.condition})` : ''}`;
    }
    case 'decision':
      return `${OUTCOME_LABELS[fact.value.outcome]} — ${fact.value.description}`;
    case 'legal_reference':
      return fact.value.citation;
    case 'amendment':
      return `${CHANGE_LABELS[fact.value.changeType]} ${fact.value.targetProvision} de ${fact.value.targetAct}`;
  }
}

/** Label and value of a fact in pt-BR; it is the subject the verifier judges. */
export function renderFact(fact: Fact): string {
  return `${fact.label}: ${formatValue(fact)}`;
}

/** An item for the verifier, plus the ids needed to turn its verdict into a VerificationItem. */
export interface PendingItem extends VerifierItemInput {
  factId: string | null;
  claimId: string | null;
}

export interface BuildItemsArgs {
  facts: Fact[];
  claims: Claim[];
  pairings: Pairing[];
  summary: Summary;
  text: string;
  chunks: Chunk[];
  deterministicFirst: boolean;
  directions: Direction[];
}

function anchoredExcerpts(fact: Fact, text: string): string[] {
  return fact.evidence
    .filter((e) => e.start !== null && e.end !== null)
    .map((e) => text.slice(e.start as number, e.end as number));
}

function paragraphText(summary: Summary, claim: Claim): string | null {
  const ref = claim.paragraphRef;
  if (!ref) return summary.overview;
  return summary.sections[ref.sectionIndex]?.paragraphs[ref.paragraphIndex]?.text ?? null;
}

/**
 * Builds the items of both directions (spec §6.5): what code can decide (equal typed values, uncertain facts) is
 * decided here; the rest goes to the verifier with anchored quotes and retrieved chunks as source excerpts.
 */
export function buildItems(args: BuildItemsArgs): { decided: VerificationItem[]; pending: PendingItem[] } {
  const decided: VerificationItem[] = [];
  const pending: PendingItem[] = [];
  let next = 1;
  const nextId = () => `V${String(next++).padStart(3, '0')}`;
  const unique = (xs: string[]) => [...new Set(xs.filter((x) => x.trim()))];

  if (args.directions.includes('summary_to_source'))
    for (const pairing of args.pairings) {
      const { claim } = pairing;
      const claimValue = claim.value;
      const equal =
        args.deterministicFirst && claim.category && claimValue
          ? pairing.candidateFacts.find(
              (f) => f.category === claim.category && compareValues(f.category, claimValue, f.value) === 'equal',
            )
          : undefined;
      if (equal) {
        decided.push({
          id: nextId(),
          direction: 'summary_to_source',
          verdict: 'supported',
          explanation: `O valor no resumo confere com o documento (${equal.label}).`,
          factId: equal.id,
          claimId: claim.id,
          decidedBy: 'code',
          usedQuotes: anchoredExcerpts(equal, args.text),
        });
        continue;
      }
      pending.push({
        itemId: nextId(),
        direction: 'summary_to_source',
        subject: claim.text,
        summaryText: paragraphText(args.summary, claim),
        sourceExcerpts: unique([
          ...pairing.candidateFacts.flatMap((f) => anchoredExcerpts(f, args.text)),
          ...pairing.chunks.map((c) => args.text.slice(c.start, c.end)),
        ]),
        factId: pairing.candidateFacts[0]?.id ?? null,
        claimId: claim.id,
      });
    }

  if (args.directions.includes('source_to_summary'))
    for (const fact of args.facts) {
      if (fact.status === 'uncertain') {
        decided.push({
          id: nextId(),
          direction: 'source_to_summary',
          verdict: 'unverifiable',
          explanation: `A informação não foi identificada com segurança no documento (${fact.uncertaintyReasons
            .map((r) => UNCERTAINTY_LABELS[r])
            .join(', ')}).`,
          factId: fact.id,
          claimId: null,
          decidedBy: 'code',
          usedQuotes: [],
        });
        continue;
      }
      const match = args.deterministicFirst
        ? args.pairings.find(
            (p) =>
              p.claim.value &&
              p.claim.category === fact.category &&
              p.candidateFacts.includes(fact) &&
              compareValues(fact.category, p.claim.value, fact.value) === 'equal',
          )
        : undefined;
      if (match) {
        decided.push({
          id: nextId(),
          direction: 'source_to_summary',
          verdict: 'consistent',
          explanation: `O resumo traz a mesma informação que o documento (${fact.label}).`,
          factId: fact.id,
          claimId: match.claim.id,
          decidedBy: 'code',
          usedQuotes: anchoredExcerpts(fact, args.text),
        });
        continue;
      }
      pending.push({
        itemId: nextId(),
        direction: 'source_to_summary',
        subject: renderFact(fact),
        summaryText: summaryPlainText(args.summary),
        sourceExcerpts: unique(anchoredExcerpts(fact, args.text)),
        factId: fact.id,
        claimId: null,
      });
    }

  return { decided, pending };
}

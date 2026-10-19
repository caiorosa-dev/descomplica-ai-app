import type { Claim, ParagraphRef, Summary } from '@app/shared';
import { claimExtractorAgent } from '../../agents/claim-extractor/agent';
import { runAgent } from '../../core/agent';
import type { StageContext } from '../../core/context';
import { retypeClaimValue } from './compare';

/** Paragraph 0 is the overview (no ParagraphRef); the others follow section order. */
export function summaryParagraphs(summary: Summary): { index: number; text: string; ref: ParagraphRef | null }[] {
  const out: { index: number; text: string; ref: ParagraphRef | null }[] = [
    { index: 0, text: summary.overview, ref: null },
  ];
  for (const [sectionIndex, section] of summary.sections.entries())
    for (const [paragraphIndex, p] of section.paragraphs.entries())
      out.push({ index: out.length, text: p.text, ref: { sectionIndex, paragraphIndex } });
  return out;
}

/** Atomic claims of the summary (ids A01, A02, ...), with values re-typed by the deterministic parsers. */
export async function extractClaims(summary: Summary, ctx: StageContext): Promise<Claim[]> {
  const paragraphs = summaryParagraphs(summary);
  ctx.events.progress('Decompondo o resumo em afirmações');
  const { claims } = await runAgent(
    claimExtractorAgent,
    { paragraphs: paragraphs.map(({ index, text }) => ({ index, text })) },
    ctx,
  );
  return claims.map((draft, i) =>
    retypeClaimValue({
      id: `A${String(i + 1).padStart(2, '0')}`,
      text: draft.text,
      paragraphRef: paragraphs[draft.paragraphIndexInInput]?.ref ?? null,
      category: draft.category === 'untyped' ? null : draft.category,
      value: draft.category === 'untyped' ? null : draft.value,
    }),
  );
}

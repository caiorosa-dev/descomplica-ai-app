import type { Chunk, Section, Summary, SummaryChunk } from '@app/shared';
import { countTokens, splitByTokens } from '../../core/tokens';
import { chunkBySections } from '../information-extraction/extract/chunk-sections';

/**
 * Source chunks for embeddings: `structural` packs the stage 2 sections (splitting large ones by paragraph) up to
 * `maxTokens`; `fixed` uses token windows of `maxTokens` with `overlapTokens`.
 */
export function chunkSource(
  text: string,
  sections: Section[],
  opts: { method: 'structural' | 'fixed'; maxTokens: number; overlapTokens: number },
): Chunk[] {
  const ranges =
    opts.method === 'fixed'
      ? splitByTokens(text, opts.maxTokens, opts.overlapTokens)
      : chunkBySections(text, sections, opts.maxTokens, 0);
  return ranges.map((r, i) => ({
    id: `C${String(i + 1).padStart(3, '0')}`,
    start: r.start,
    end: r.end,
    tokens: countTokens(text.slice(r.start, r.end)),
  }));
}

/** One chunk per summary paragraph, plus the overview as P00. */
export function chunkSummary(summary: Summary): SummaryChunk[] {
  const chunks: SummaryChunk[] = [
    {
      id: 'P00',
      text: summary.overview,
      tokens: countTokens(summary.overview),
      sectionIndex: null,
      paragraphIndex: null,
    },
  ];
  summary.sections.forEach((section, sectionIndex) =>
    section.paragraphs.forEach((p, paragraphIndex) =>
      chunks.push({
        id: `P${String(chunks.length).padStart(2, '0')}`,
        text: p.text,
        tokens: countTokens(p.text),
        sectionIndex,
        paragraphIndex,
      }),
    ),
  );
  return chunks;
}

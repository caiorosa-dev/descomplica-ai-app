import type { Line, LineDocument, Page } from '../types';
import { type CleaningResult, removeLines } from './types';

const MIN_PAGES = 3;

function edgeKey(text: string): string {
  return text.toLowerCase().replace(/\d/g, '#').replace(/\s+/g, ' ').trim();
}

function inEdgeBand(line: Line, page: Page, band: number): boolean {
  return line.y <= band * page.height || line.y >= (1 - band) * page.height;
}

/** Header and footer lines whose normalized form repeats on at least `repeatThreshold` of the pages (spec §6.1, rule 2). */
export function removeRepeatedEdges(
  doc: LineDocument,
  opts: { edgeBandRatio: number; repeatThreshold: number },
): CleaningResult {
  if (doc.pages.length < MIN_PAGES) return { doc, removed: [] };
  const pagesByKey = new Map<string, Set<number>>();
  for (const page of doc.pages)
    for (const line of page.lines)
      if (inEdgeBand(line, page, opts.edgeBandRatio)) {
        const key = edgeKey(line.text);
        const pages = pagesByKey.get(key) ?? new Set<number>();
        pages.add(page.number);
        pagesByKey.set(key, pages);
      }
  const minPages = Math.ceil(opts.repeatThreshold * doc.pages.length);
  const pageOf = new Map(doc.pages.map((p) => [p.number, p]));
  return removeLines(doc, 'repeated_edge', (line) => {
    const page = pageOf.get(line.page);
    if (!page || !inEdgeBand(line, page, opts.edgeBandRatio)) return false;
    return (pagesByKey.get(edgeKey(line.text))?.size ?? 0) >= minPages;
  });
}

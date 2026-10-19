import type { RemovedLine } from '@app/shared';
import type { Line, LineDocument } from '../types';

export interface CleaningResult {
  doc: LineDocument;
  removed: RemovedLine[];
}

/** Removes the lines matched by `predicate`, reporting each one under `rule`. */
export function removeLines(doc: LineDocument, rule: string, predicate: (line: Line) => boolean): CleaningResult {
  const removed: RemovedLine[] = [];
  const pages = doc.pages.map((page) => ({
    ...page,
    lines: page.lines.filter((line) => {
      if (!predicate(line)) return true;
      removed.push({ rule, page: doc.format === 'pdf' ? line.page : null, text: line.text });
      return false;
    }),
  }));
  return { doc: { ...doc, pages }, removed };
}

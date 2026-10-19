import type { SourceFormat } from '@app/shared';

/** One text line; `y` is measured from the top of the page and `id` is sequential across the document. */
export interface Line {
  id: number;
  text: string;
  y: number;
  height: number;
  page: number;
}

export interface Page {
  number: number;
  height: number;
  lines: Line[];
}

export interface LineDocument {
  format: SourceFormat;
  pages: Page[];
}

export function allLines(doc: LineDocument): Line[] {
  return doc.pages.flatMap((p) => p.lines);
}

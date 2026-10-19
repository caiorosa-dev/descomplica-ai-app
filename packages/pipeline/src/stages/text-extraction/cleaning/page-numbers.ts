import type { LineDocument } from '../types';
import { type CleaningResult, removeLines } from './types';

const PAGE_NUMBER_PATTERNS = [
  /^-?\s*\d{1,4}\s*-?$/,
  /^\d{1,4}\s*\/\s*\d{1,4}$/,
  /^p[áa]g(ina|\.)?\s*\d{1,4}(\s*(de|\/)\s*\d{1,4})?$/iu,
];

export function isPageNumber(text: string): boolean {
  return PAGE_NUMBER_PATTERNS.some((re) => re.test(text.trim()));
}

/** Isolated page-number lines such as `- 3 -`, `3/20`, `Pág. 3` and `Página 3 de 20` (spec §6.1, rule 3). */
export function removePageNumbers(doc: LineDocument): CleaningResult {
  return removeLines(doc, 'page_number', (line) => isPageNumber(line.text));
}

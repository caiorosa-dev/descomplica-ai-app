import type { BoilerplatePatternSet } from '@app/shared';
import type { LineDocument } from '../types';
import { BOILERPLATE_PATTERN_SETS } from './patterns';
import type { CleaningResult } from './types';
import { removeLines } from './types';

export { BOILERPLATE_PATTERN_SETS };

/** Applies each requested pattern set in turn; removed lines are reported as `boilerplate:<set>`. */
export function removeBoilerplate(doc: LineDocument, sets: BoilerplatePatternSet[]): CleaningResult {
  let current = doc;
  const removed: CleaningResult['removed'] = [];
  for (const set of sets) {
    const patterns = BOILERPLATE_PATTERN_SETS[set];
    const result = removeLines(current, `boilerplate:${set}`, (line) => patterns.some((re) => re.test(line.text)));
    current = result.doc;
    removed.push(...result.removed);
  }
  return { doc: current, removed };
}

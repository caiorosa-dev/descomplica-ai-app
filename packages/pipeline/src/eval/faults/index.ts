import { type Fact, FaultType, type InjectedFault, type Summary } from '@app/shared';
import { dateShift } from './date-shift';
import { deadlineChange } from './deadline-change';
import { fabrication } from './fabrication';
import { omission } from './omission';
import { outcomeFlip } from './outcome-flip';
import { valueChange } from './value-change';

export { FABRICATED_SENTENCE } from './fabrication';
export { OUTCOME_FLIPS } from './outcome-flip';

export const FAULT_TYPES: FaultType[] = [...FaultType.options];

type Mutator = (summary: Summary, facts: Fact[]) => { summary: Summary; fault: InjectedFault } | null;

const MUTATORS: Record<FaultType, Mutator> = {
  date_shift: dateShift,
  value_change: valueChange,
  deadline_change: deadlineChange,
  outcome_flip: outcomeFlip,
  omission,
  fabrication,
};

/** Applies one deterministic fault to a summary; null when that fault has nothing to act on. */
export function applyFault(
  type: FaultType,
  summary: Summary,
  facts: Fact[],
): { summary: Summary; fault: InjectedFault } | null {
  return MUTATORS[type](summary, facts);
}

import { z } from 'zod';
import { AlertType, FactCategory } from './enums';

export const FaultType = z.enum([
  'date_shift',
  'value_change',
  'deadline_change',
  'outcome_flip',
  'omission',
  'fabrication',
]);
export type FaultType = z.infer<typeof FaultType>;

export const InjectedFault = z.object({
  type: FaultType,
  description: z.string(),
  expected: z.object({ alertType: AlertType, category: FactCategory.nullable() }),
});
export type InjectedFault = z.infer<typeof InjectedFault>;

import type { StageName } from '@app/shared';
import type { z } from 'zod';
import type { StageContext } from './context';

export interface Stage<I, O> {
  name: StageName;
  output: z.ZodType<O>;
  run(input: I, ctx: StageContext): Promise<O>;
}

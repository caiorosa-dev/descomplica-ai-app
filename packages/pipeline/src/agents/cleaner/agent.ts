import { z } from 'zod';
import { defineAgent } from '../../core/agent';
import { CLEANER_SYSTEM_PROMPT, renderCleanerPrompt } from './prompt';

export const CleanerInput = z.object({
  lines: z.array(z.object({ id: z.number().int(), page: z.number().int(), text: z.string() })),
});

export const CleanerOutput = z.object({
  removeLineIds: z.array(z.number().int()),
  reasons: z.array(z.object({ id: z.number().int(), reason: z.string() })),
});

/** Flags noise lines; never rewrites text, so whatever remains is still literal (spec §6.1). */
export const cleanerAgent = defineAgent({
  name: 'cleaner',
  version: '1.0.0',
  role: 'cleaning',
  input: CleanerInput,
  output: CleanerOutput,
  system: CLEANER_SYSTEM_PROMPT,
  prompt: (input) => renderCleanerPrompt(input.lines),
  maxOutputTokens: 2000,
});

import { Direction, Verdict } from '@app/shared';
import { z } from 'zod';
import { defineAgent } from '../../core/agent';
import { renderVerifierPrompt, VERIFIER_SYSTEM_PROMPT } from './prompt';

export const VerifierItemInput = z.object({
  itemId: z.string(),
  direction: Direction,
  subject: z.string(),
  summaryText: z.string().nullable(),
  sourceExcerpts: z.array(z.string()),
});
export type VerifierItemInput = z.infer<typeof VerifierItemInput>;

export const VerifierOutput = z.object({
  verdicts: z.array(
    z.object({ itemId: z.string(), verdict: Verdict, explanation: z.string(), usedQuotes: z.array(z.string()) }),
  ),
});

/** Judges source/summary pairs. It never receives the summarizer's reasoning (spec §6.5). */
export const verifierAgent = defineAgent({
  name: 'verifier',
  version: '1.0.0',
  role: 'verification',
  input: z.object({ items: z.array(VerifierItemInput) }),
  output: VerifierOutput,
  system: VERIFIER_SYSTEM_PROMPT,
  prompt: (input) => renderVerifierPrompt(input.items),
  maxOutputTokens: 6000,
});

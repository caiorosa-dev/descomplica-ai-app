import { ClaimDraft } from '@app/shared';
import { z } from 'zod';
import { defineAgent } from '../../core/agent';
import { CLAIM_EXTRACTOR_SYSTEM_PROMPT, renderClaimExtractorPrompt } from './prompt';

export const ClaimExtractorInput = z.object({
  paragraphs: z.array(z.object({ index: z.number().int(), text: z.string() })),
});

export const ClaimExtractorOutput = z.object({ claims: z.array(ClaimDraft) });

export const claimExtractorAgent = defineAgent({
  name: 'claim-extractor',
  version: '1.0.0',
  role: 'claimExtraction',
  input: ClaimExtractorInput,
  output: ClaimExtractorOutput,
  system: CLAIM_EXTRACTOR_SYSTEM_PROMPT,
  prompt: (input) => renderClaimExtractorPrompt(input.paragraphs),
  maxOutputTokens: 4000,
});

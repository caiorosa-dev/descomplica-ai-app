import {
  CategoryValue,
  Classification,
  DocumentSubtype,
  DocumentType,
  FactCategory,
  FactStatus,
  Summary,
} from '@app/shared';
import { z } from 'zod';
import { defineAgent } from '../../core/agent';
import { renderSummarizerPrompt, SUMMARIZER_SYSTEM_PROMPT } from './prompt';

export const SummarizerInput = z.object({
  documentType: DocumentType,
  subtype: DocumentSubtype.nullable(),
  metadata: Classification.shape.metadata,
  text: z.string(),
  facts: z.array(
    z.object({ id: z.string(), category: FactCategory, label: z.string(), value: CategoryValue, status: FactStatus }),
  ),
  headings: z.array(z.string()),
  audience: z.enum(['layperson', 'professional']),
  targetWords: z.number().int().positive(),
  uncertainFacts: z.enum(['omit', 'hedge']),
  includeGlossary: z.boolean(),
});

export const summarizerAgent = defineAgent({
  name: 'summarizer',
  version: '1.0.0',
  role: 'summarization',
  input: SummarizerInput,
  output: Summary,
  system: SUMMARIZER_SYSTEM_PROMPT,
  prompt: renderSummarizerPrompt,
  maxOutputTokens: 4000,
});

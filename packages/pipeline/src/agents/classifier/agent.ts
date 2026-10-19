import { Classification, DocumentType } from '@app/shared';
import { z } from 'zod';
import { defineAgent } from '../../core/agent';
import { CLASSIFIER_SYSTEM_PROMPT, renderClassifierPrompt } from './prompt';

export const ClassifierInput = z.object({ head: z.string(), tail: z.string(), forcedType: DocumentType.nullable() });

export const classifierAgent = defineAgent({
  name: 'classifier',
  version: '1.0.0',
  role: 'classification',
  input: ClassifierInput,
  output: Classification,
  system: CLASSIFIER_SYSTEM_PROMPT,
  prompt: renderClassifierPrompt,
  maxOutputTokens: 800,
});

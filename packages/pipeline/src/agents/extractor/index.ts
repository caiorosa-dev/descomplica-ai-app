import { DocumentSubtype, DocumentType, ExtractorOutput, FactCategory, SectionKind } from '@app/shared';
import { z } from 'zod';
import { type AgentDefinition, defineAgent } from '../../core/agent';
import { BASE_EXTRACTION_RULES, renderExtractorPrompt } from './base-prompt';
import { COURT_DECISION_GUIDANCE } from './court-decision';
import { GENERIC_GUIDANCE } from './generic';
import { NORMATIVE_ACT_GUIDANCE } from './normative-act';

export const ExtractorInput = z.object({
  documentType: DocumentType,
  subtype: DocumentSubtype.nullable(),
  text: z.string(),
  sections: z.array(z.object({ id: z.string(), kind: SectionKind, label: z.string() })),
  categories: z.array(FactCategory).min(1),
});

const GUIDANCE: Record<DocumentType, { name: string; guidance: string }> = {
  court_decision: { name: 'extractor.court-decision', guidance: COURT_DECISION_GUIDANCE },
  normative_act: { name: 'extractor.normative-act', guidance: NORMATIVE_ACT_GUIDANCE },
  generic: { name: 'extractor.generic', guidance: GENERIC_GUIDANCE },
};

export type ExtractorAgent = AgentDefinition<typeof ExtractorInput, typeof ExtractorOutput>;

const cache = new Map<DocumentType, ExtractorAgent>();

export function createExtractorAgent(type: DocumentType): ExtractorAgent {
  const cached = cache.get(type);
  if (cached) return cached;
  const { name, guidance } = GUIDANCE[type];
  const agent = defineAgent({
    name,
    version: '1.0.0',
    role: 'extraction',
    input: ExtractorInput,
    output: ExtractorOutput,
    system: `${BASE_EXTRACTION_RULES}\n\n${guidance}`,
    prompt: renderExtractorPrompt,
    maxOutputTokens: 8000,
  });
  cache.set(type, agent);
  return agent;
}

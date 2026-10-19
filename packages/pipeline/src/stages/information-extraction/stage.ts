import { InformationExtractionOutput, type TextExtractionOutput } from '@app/shared';
import type { Stage } from '../../core/stage';
import { classifyDocument } from './classify';
import { callExtractors } from './extract/call-extractors';
import { type GroundedExtractorOutput, mergeFacts } from './extract/merge';
import { groundQuote } from './grounding/ground-quote';
import { buildGroundingIndex } from './grounding/index';
import { finalizeFacts } from './postprocess';
import { segmentDocument } from './segment';

export interface InformationExtractionInput {
  text: TextExtractionOutput;
}

export const informationExtractionStage: Stage<InformationExtractionInput, InformationExtractionOutput> = {
  name: 'information_extraction',
  output: InformationExtractionOutput,
  async run(input, ctx) {
    const { canonicalText, pageMap } = input.text;
    const classification = await classifyDocument(input.text, ctx);

    ctx.events.progress('Segmentando o documento');
    const { sections, fallback } = segmentDocument(canonicalText, classification.documentType);
    if (fallback)
      ctx.events.warn(
        'segmentation_fallback',
        'Os marcadores esperados para o tipo do documento não foram encontrados; o texto foi dividido por parágrafos.',
      );

    const { outputs } = await callExtractors({ text: canonicalText, sections, classification }, ctx);

    ctx.events.progress('Ancorando as citações no texto');
    const index = buildGroundingIndex(canonicalText, pageMap, sections);
    const threshold = ctx.config.extraction.grounding.fuzzyThreshold;
    const grounded: GroundedExtractorOutput[] = outputs.map(({ output }) => ({
      facts: output.facts.map((fact) => ({
        ...fact,
        evidence: fact.evidence.map((e) => {
          const { start, end, page, sectionId, matchType, matchScore } = groundQuote(e.quote, index, threshold);
          return { quote: e.quote, start, end, page, sectionId, matchType, matchScore };
        }),
      })),
      notFound: output.notFound,
      ambiguities: output.ambiguities.map((a) => ({ ...a, match: groundQuote(a.quote, index, threshold) })),
    }));

    ctx.events.progress('Conferindo os fatos');
    const merged = mergeFacts(grounded);
    const facts = finalizeFacts(merged, ctx.config.extraction.minConfidence);
    return {
      classification,
      sections,
      facts,
      notFound: merged.notFound,
      ambiguities: merged.ambiguities.map(({ description, quote }) => ({ description, quote })),
    };
  },
};

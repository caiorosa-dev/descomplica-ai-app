import {
  type InformationExtractionOutput,
  SummarizationOutput,
  type Summary,
  type TextExtractionOutput,
} from '@app/shared';
import { summarizerAgent } from '../../agents/summarizer/agent';
import { headingsFor, summaryPlainText, TARGET_WORDS } from '../../agents/summarizer/headings';
import { runAgent } from '../../core/agent';
import { mapWithConcurrency } from '../../core/concurrency';
import type { StageContext } from '../../core/context';
import type { Stage } from '../../core/stage';
import { countTokens } from '../../core/tokens';
import { chunkBySections } from '../information-extraction/extract/chunk-sections';
import { compressionRatio, fleschPt } from './readability';

export interface SummarizationInput {
  text: TextExtractionOutput;
  info: InformationExtractionOutput;
}

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

function dropUnknownRefs(summary: Summary, known: Set<string>, ctx: StageContext): Summary {
  const unknown = new Set<string>();
  const sections = summary.sections.map((s) => ({
    ...s,
    paragraphs: s.paragraphs.map((p) => ({
      ...p,
      factRefs: p.factRefs.filter((ref) => {
        if (known.has(ref)) return true;
        unknown.add(ref);
        return false;
      }),
    })),
  }));
  if (unknown.size > 0)
    ctx.events.warn(
      'summary_unknown_fact_refs',
      `O resumo citou fatos inexistentes, que foram removidos: ${[...unknown].join(', ')}.`,
    );
  return { ...summary, sections };
}

export const summarizationStage: Stage<SummarizationInput, SummarizationOutput> = {
  name: 'summarization',
  output: SummarizationOutput,
  async run(input, ctx) {
    const config = ctx.config.summarization;
    const { canonicalText } = input.text;
    const { classification, sections } = input.info;
    const facts = config.useExtractedFacts
      ? input.info.facts
          .filter((f) => f.status === 'confirmed' || config.uncertainFacts === 'hedge')
          .map(({ id, category, label, value, status }) => ({ id, category, label, value, status }))
      : [];
    const base = {
      documentType: classification.documentType,
      subtype: classification.subtype,
      metadata: classification.metadata,
      facts,
      headings: headingsFor(classification.documentType, classification.subtype),
      audience: config.audience,
      targetWords: TARGET_WORDS[config.targetLength],
      uncertainFacts: config.uncertainFacts,
      includeGlossary: config.includeGlossary,
    };

    const tooLong = countTokens(canonicalText) > config.maxDirectTokens;
    if (config.strategy === 'direct' && tooLong)
      ctx.events.warn(
        'summarization_auto_hierarchical',
        `O texto passa de ${config.maxDirectTokens} tokens; o resumo foi feito por partes (hierárquico).`,
      );

    let text = canonicalText;
    if (config.strategy === 'hierarchical' || tooLong) {
      const chunks = chunkBySections(canonicalText, sections, Math.floor(config.maxDirectTokens / 4), 0);
      let done = 0;
      const partials = await mapWithConcurrency(
        chunks,
        ctx.llmConcurrency,
        async (chunk) => {
          const partial = await runAgent(summarizerAgent, { ...base, text: chunk.text }, ctx);
          ctx.events.progress(`Resumindo partes: ${++done}/${chunks.length}`, done, chunks.length);
          return partial;
        },
        ctx.signal,
      );
      text = partials.map(summaryPlainText).join('\n\n');
    }

    ctx.events.progress('Escrevendo o resumo');
    let summary = await runAgent(summarizerAgent, { ...base, text }, ctx);
    summary = dropUnknownRefs(summary, new Set(facts.map((f) => f.id)), ctx);
    if (!config.includeGlossary) summary = { ...summary, glossary: [] };

    const plain = summaryPlainText(summary);
    return {
      summary,
      readability: { source: fleschPt(canonicalText), summary: fleschPt(plain) },
      compressionRatio: compressionRatio(input.text.stats.words, wordCount(plain)),
    };
  },
};

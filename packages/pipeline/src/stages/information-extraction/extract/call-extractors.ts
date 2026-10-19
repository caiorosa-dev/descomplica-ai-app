import type { Classification, ExtractorOutput, FactCategory, Section } from '@app/shared';
import { createExtractorAgent } from '../../../agents/extractor';
import { runAgent } from '../../../core/agent';
import { mapWithConcurrency } from '../../../core/concurrency';
import type { StageContext } from '../../../core/context';
import { countTokens } from '../../../core/tokens';
import { chunkBySections, type TextChunk } from './chunk-sections';

export const CATEGORY_GROUPS: FactCategory[][] = [
  ['date', 'deadline'],
  ['monetary_value'],
  ['obligation'],
  ['decision'],
  ['legal_reference'],
  ['amendment'],
];

export interface ExtractorCallsResult {
  outputs: { chunk: TextChunk; output: ExtractorOutput }[];
  strategyUsed: 'single_pass' | 'chunked';
}

/** Runs the type's extractor over the text (whole or chunked) and category groups (unified or per category). */
export async function callExtractors(
  input: { text: string; sections: Section[]; classification: Classification },
  ctx: StageContext,
): Promise<ExtractorCallsResult> {
  const config = ctx.config.extraction;
  const { text, sections, classification } = input;
  const categories = [
    ...new Set<FactCategory>([
      ...config.categories,
      ...(classification.subtype === 'amendment' ? (['amendment'] as const) : []),
    ]),
  ];

  const tooLong = countTokens(text) > config.maxSinglePassTokens;
  const chunked = config.strategy === 'chunked' || tooLong;
  if (config.strategy === 'single_pass' && tooLong)
    ctx.events.warn(
      'extraction_auto_chunked',
      `O texto passa de ${config.maxSinglePassTokens} tokens; a extração foi feita em partes (chunked).`,
    );
  const chunks: TextChunk[] = chunked
    ? chunkBySections(text, sections, config.chunkTokens, config.overlapTokens)
    : [{ start: 0, end: text.length, text }];
  const groups =
    config.agentSplit === 'per_category'
      ? CATEGORY_GROUPS.map((g) => g.filter((c) => categories.includes(c))).filter((g) => g.length > 0)
      : [categories];

  const agent = createExtractorAgent(classification.documentType);
  const jobs = chunks.flatMap((chunk) => groups.map((group) => ({ chunk, group })));
  let done = 0;
  const outputs = await mapWithConcurrency(
    jobs,
    ctx.llmConcurrency,
    async ({ chunk, group }) => {
      const output = await runAgent(
        agent,
        {
          documentType: classification.documentType,
          subtype: classification.subtype,
          text: chunk.text,
          sections: sections
            .filter((s) => s.start < chunk.end && s.end > chunk.start)
            .map(({ id, kind, label }) => ({ id, kind, label })),
          categories: group,
        },
        ctx,
      );
      done++;
      ctx.events.progress(`Extraindo fatos: chamada ${done}/${jobs.length}`, done, jobs.length);
      return { chunk, output };
    },
    ctx.signal,
  );
  return { outputs, strategyUsed: chunked ? 'chunked' : 'single_pass' };
}

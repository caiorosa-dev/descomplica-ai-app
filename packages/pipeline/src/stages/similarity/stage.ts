import {
  type InformationExtractionOutput,
  type SimilarityHeadline,
  type SimilarityMetrics,
  SimilarityOutput,
  type SummarizationOutput,
  type TextExtractionOutput,
} from '@app/shared';
import type { Stage } from '../../core/stage';
import { chunkSource, chunkSummary } from './chunking';
import { computeAlignment, markBottomPercent, normalizeVector } from './metrics';

export interface SimilarityInput {
  text: TextExtractionOutput;
  info: InformationExtractionOutput;
  summarization: SummarizationOutput;
}

export const HEADLINE_FIELD: Record<SimilarityHeadline, keyof SimilarityMetrics> = {
  centroid: 'centroid',
  coverage: 'coverage',
  support: 'support',
  alignment_f1: 'alignmentF1',
};

export const similarityStage: Stage<SimilarityInput, SimilarityOutput> = {
  name: 'similarity',
  output: SimilarityOutput,
  async run(input, ctx) {
    const config = ctx.config.similarity;
    const { canonicalText } = input.text;
    ctx.events.progress('Dividindo o texto em trechos');
    const sourceChunks = chunkSource(canonicalText, input.info.sections, config.chunking);
    const summaryChunks = chunkSummary(input.summarization.summary);
    const options = { model: config.embeddingModel, dimensions: config.dimensions };

    ctx.events.progress('Calculando embeddings do documento');
    const sourceVectors = (
      await ctx.embedder.embed(
        sourceChunks.map((c) => canonicalText.slice(c.start, c.end)),
        options,
      )
    ).map(normalizeVector);
    ctx.events.progress('Calculando embeddings do resumo');
    const summaryVectors = (
      await ctx.embedder.embed(
        summaryChunks.map((c) => c.text),
        options,
      )
    ).map(normalizeVector);

    ctx.events.progress('Comparando documento e resumo');
    const { metrics, coverageScores, supportScores } = computeAlignment(
      sourceChunks.map((c, i) => ({ vector: sourceVectors[i] as number[], tokens: c.tokens })),
      summaryVectors,
    );
    const coverageMarks = markBottomPercent(coverageScores, config.highlightBottomPercent);
    const supportMarks = markBottomPercent(supportScores, config.highlightBottomPercent);
    return {
      sourceChunks,
      summaryChunks,
      metrics,
      headline: { metric: config.headline, value: metrics[HEADLINE_FIELD[config.headline]] },
      coverageByChunk: sourceChunks.map((c, i) => ({
        chunkId: c.id,
        score: coverageScores[i] as number,
        highlighted: coverageMarks[i] as boolean,
      })),
      supportByParagraph: summaryChunks.map((c, i) => ({
        chunkId: c.id,
        score: supportScores[i] as number,
        highlighted: supportMarks[i] as boolean,
      })),
    };
  },
};

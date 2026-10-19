import type { PrismaClient } from '@app/db';
import { computeAlignment, type Embedder, normalizeVector } from '@app/pipeline';
import { type CrossSimilarityDto, parsePipelineConfig } from '@app/shared';
import { HttpError, notFound } from '../../http-error';
import { loadStageOutputs } from '../../runtime/persistence/load-outputs';

/**
 * Summary of each run against the document of every run, reusing the embedding cache. Embeddings computed here
 * belong to no run, so they are not recorded as EmbeddingCalls.
 */
export async function crossSimilarity(
  prisma: PrismaClient,
  embedder: Embedder,
  runIds: string[],
): Promise<CrossSimilarityDto> {
  const runs = await Promise.all(
    runIds.map(async (id) => {
      const run = await prisma.run.findUnique({ where: { id }, select: { id: true, documentId: true, config: true } });
      if (!run) throw notFound('Execução');
      return { ...run, config: parsePipelineConfig(run.config), outputs: await loadStageOutputs(prisma, id) };
    }),
  );
  const models = new Set(
    runs.map((r) => `${r.config.similarity.embeddingModel}|${r.config.similarity.dimensions ?? 0}`),
  );
  if (models.size > 1)
    throw new HttpError(
      400,
      'MIXED_EMBEDDING_MODELS',
      'As execuções usam modelos de embedding diferentes e não podem ser comparadas.',
      {
        models: [...models],
      },
    );
  const ready = runs.flatMap((r) =>
    r.outputs.similarity && r.outputs.text_extraction
      ? [{ similarity: r.outputs.similarity, text: r.outputs.text_extraction.canonicalText }]
      : [],
  );
  if (ready.length < runs.length)
    throw new HttpError(409, 'RUN_NOT_COMPLETED', 'Algumas execuções ainda não têm a etapa de similaridade.', {
      runIds: runs.filter((r) => !r.outputs.similarity || !r.outputs.text_extraction).map((r) => r.id),
    });

  const { embeddingModel, dimensions } = runs[0]?.config.similarity ?? { embeddingModel: '', dimensions: null };
  const options = { model: embeddingModel, dimensions };
  const vectors = await Promise.all(
    ready.map(async ({ similarity, text }) => {
      const source = (
        await embedder.embed(
          similarity.sourceChunks.map((c) => text.slice(c.start, c.end)),
          options,
        )
      ).map(normalizeVector);
      const summary = (
        await embedder.embed(
          similarity.summaryChunks.map((c) => c.text),
          options,
        )
      ).map(normalizeVector);
      return {
        source: similarity.sourceChunks.map((c, i) => ({ vector: source[i] as number[], tokens: c.tokens })),
        summary,
      };
    }),
  );
  return {
    runIds,
    documentIds: runs.map((r) => r.documentId),
    matrix: vectors.map((row) => vectors.map((col) => computeAlignment(col.source, row.summary).metrics.alignmentF1)),
  };
}

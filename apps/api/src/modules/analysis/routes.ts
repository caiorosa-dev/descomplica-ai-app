import { CrossSimilarityBody, CrossSimilarityDto } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createEmbedder, defaultEmbedMany } from '../../runtime/adapters/embedder';
import { crossSimilarity } from './service';

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  const embedder = createEmbedder({
    prisma: app.prisma,
    embedMany: app.aiOverrides.embedManyFn ?? defaultEmbedMany(app.env),
    onCall: async () => {},
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/analysis/cross-similarity',
      { schema: { body: CrossSimilarityBody, response: { 200: CrossSimilarityDto } } },
      (request) => crossSimilarity(app.prisma, embedder, request.body.runIds),
    );
}

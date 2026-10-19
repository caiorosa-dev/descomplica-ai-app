import { MODEL_CATALOG, ProvidersDto } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { availableProviders } from '../../runtime/adapters/model-resolver';

export async function providersRoutes(app: FastifyInstance): Promise<void> {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/providers', { schema: { response: { 200: ProvidersDto } } }, async () => {
      const configured = new Set(availableProviders(app.env));
      return {
        providers: (['openai', 'anthropic'] as const).map((id) => ({ id, configured: configured.has(id) })),
        models: [...MODEL_CATALOG],
      };
    });
}

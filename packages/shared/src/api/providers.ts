import { z } from 'zod';
import { ModelCatalogEntry, Provider } from '../config/catalog';

export const ProvidersDto = z.object({
  providers: z.array(z.object({ id: Provider, configured: z.boolean() })),
  models: z.array(ModelCatalogEntry),
});
export type ProvidersDto = z.infer<typeof ProvidersDto>;

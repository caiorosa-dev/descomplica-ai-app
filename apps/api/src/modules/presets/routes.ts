import { CreatePresetBody, PresetDto, UpdatePresetBody } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IdParams } from '../documents/routes';
import { createPresetsService } from './service';

export async function presetsRoutes(app: FastifyInstance): Promise<void> {
  const service = createPresetsService(app.prisma);
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get('/presets', { schema: { response: { 200: z.array(PresetDto) } } }, () => service.list());
  r.post('/presets', { schema: { body: CreatePresetBody, response: { 201: PresetDto } } }, async (request, reply) =>
    reply.status(201).send(await service.create(request.body)),
  );
  r.get('/presets/:id', { schema: { params: IdParams, response: { 200: PresetDto } } }, (request) =>
    service.get(request.params.id),
  );
  r.put(
    '/presets/:id',
    { schema: { params: IdParams, body: UpdatePresetBody, response: { 200: PresetDto } } },
    (request) => service.update(request.params.id, request.body),
  );
  r.delete('/presets/:id', { schema: { params: IdParams } }, async (request, reply) => {
    await service.remove(request.params.id);
    return reply.status(204).send();
  });
  r.post(
    '/presets/:id/duplicate',
    { schema: { params: IdParams, response: { 201: PresetDto } } },
    async (request, reply) => reply.status(201).send(await service.duplicate(request.params.id)),
  );
}

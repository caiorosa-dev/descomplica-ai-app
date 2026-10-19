import { CreateRunBody, ListRunsQuery, RunDto } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IdParams } from '../documents/routes';
import { createRunsService } from './service';

export async function runsRoutes(app: FastifyInstance): Promise<void> {
  const service = createRunsService({ prisma: app.prisma, env: app.env, queue: app.runQueue });
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.post('/runs', { schema: { body: CreateRunBody, response: { 202: RunDto } } }, async (request, reply) =>
    reply.status(202).send(await service.create(request.body)),
  );
  r.get('/runs', { schema: { querystring: ListRunsQuery, response: { 200: z.array(RunDto) } } }, (request) =>
    service.list(request.query),
  );
  r.get('/runs/:id', { schema: { params: IdParams, response: { 200: RunDto } } }, (request) =>
    service.get(request.params.id),
  );
  r.post('/runs/:id/cancel', { schema: { params: IdParams, response: { 202: RunDto } } }, async (request, reply) =>
    reply.status(202).send(await service.cancel(request.params.id)),
  );
}

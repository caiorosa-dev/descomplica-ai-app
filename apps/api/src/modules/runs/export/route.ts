import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { HttpError, notFound } from '../../../http-error';
import { IdParams } from '../../documents/routes';
import { buildRunExport } from './build-export';
import { buildCsvZip } from './zip';

export async function runExportRoute(app: FastifyInstance): Promise<void> {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/runs/:id/export',
      { schema: { params: IdParams, querystring: z.object({ format: z.enum(['json', 'csv']).default('json') }) } },
      async (request, reply) => {
        const { id } = request.params;
        const run = await app.prisma.run.findUnique({ where: { id }, select: { status: true } });
        if (!run) throw notFound('Execução');
        if (run.status !== 'completed')
          throw new HttpError(409, 'RUN_NOT_COMPLETED', 'Só é possível exportar execuções concluídas.');
        const exp = await buildRunExport(app.prisma, id);
        if (request.query.format === 'json')
          return reply
            .header('content-type', 'application/json; charset=utf-8')
            .header('content-disposition', `attachment; filename="run-${id}.json"`)
            .send(JSON.stringify(exp, null, 2));
        const calls = await app.prisma.llmCall.findMany({ where: { runId: id }, orderBy: { createdAt: 'asc' } });
        const zip = buildCsvZip(
          exp,
          calls.map((c) => ({
            id: c.id,
            agent: c.agent,
            agentVersion: c.agentVersion,
            model: c.model,
            attempt: c.attempt,
            status: c.status,
            inputTokens: c.inputTokens,
            outputTokens: c.outputTokens,
            costUsd: c.costUsd,
            latencyMs: c.latencyMs,
            createdAt: c.createdAt.toISOString(),
          })),
        );
        return reply
          .header('content-type', 'application/zip')
          .header('content-disposition', `attachment; filename="run-${id}.zip"`)
          .send(Buffer.from(zip));
      },
    );
}

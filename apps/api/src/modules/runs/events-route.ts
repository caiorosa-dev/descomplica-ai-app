import { type RunEvent, TERMINAL_RUN_STATUSES } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notFound } from '../../http-error';
import { rowToEvent } from '../../runtime/event-recorder';
import { IdParams } from '../documents/routes';

const HEARTBEAT_MS = 15_000;

const isTerminal = (event: RunEvent) => event.type === 'run.status' && TERMINAL_RUN_STATUSES.includes(event.status);
const format = (event: RunEvent) => `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

/**
 * SSE with replay (spec §7): subscribe first, replay stored events after Last-Event-ID, then stream live ones,
 * skipping anything already sent; closes after the terminal run.status.
 */
export async function runEventsRoute(app: FastifyInstance): Promise<void> {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/runs/:id/events',
      { schema: { params: IdParams, querystring: z.object({ lastEventId: z.coerce.number().int().optional() }) } },
      async (request, reply) => {
        const runId = request.params.id;
        const run = await app.prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
        if (!run) throw notFound('Execução');
        const header = request.headers['last-event-id'];
        let lastSent = Number((Array.isArray(header) ? header[0] : header) ?? request.query.lastEventId ?? 0) || 0;

        const buffer: RunEvent[] = [];
        let live = false;
        let closed = false;
        let heartbeat: NodeJS.Timeout | undefined;
        let unsubscribe = () => {};
        const finish = () => {
          if (closed) return;
          closed = true;
          unsubscribe();
          clearInterval(heartbeat);
          reply.raw.end();
        };
        const write = (event: RunEvent) => {
          if (closed || event.seq <= lastSent) return;
          reply.raw.write(format(event));
          lastSent = event.seq;
          if (isTerminal(event)) finish();
        };
        unsubscribe = app.eventBus.subscribe(runId, (event) => (live ? write(event) : buffer.push(event)));

        reply.hijack();
        reply.raw.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        request.raw.on('close', finish);

        const stored = await app.prisma.runEvent.findMany({
          where: { runId, seq: { gt: lastSent } },
          orderBy: { seq: 'asc' },
        });
        for (const row of stored) write(rowToEvent(row));
        for (const event of buffer.sort((a, b) => a.seq - b.seq)) write(event);
        live = true;
        if (closed) return;
        if (TERMINAL_RUN_STATUSES.includes(run.status)) return finish();
        heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), HEARTBEAT_MS);
      },
    );
}

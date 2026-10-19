import { createPrismaClient, type PrismaClient } from '@app/db';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/** Decorates `app.prisma`; a client created here is disconnected when the app closes. */
export function registerPrisma(app: FastifyInstance, opts: { url: string; prisma?: PrismaClient }): void {
  const prisma = opts.prisma ?? createPrismaClient(opts.url);
  app.decorate('prisma', prisma);
  if (!opts.prisma) app.addHook('onClose', async () => prisma.$disconnect());
}

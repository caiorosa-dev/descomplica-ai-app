import type { PrismaClient } from '@app/db';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Env } from './env';
import { healthRoutes } from './modules/health/routes';
import { registerErrorHandler } from './plugins/error-handler';
import { registerPrisma } from './plugins/prisma';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export interface BuildAppOptions {
  env: Env;
  prisma?: PrismaClient;
  logger?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
  }
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger === false ? false : { level: opts.env.LOG_LEVEL } });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', opts.env);
  registerErrorHandler(app);
  registerPrisma(app, { url: opts.env.DATABASE_URL, prisma: opts.prisma });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  await app.register(healthRoutes);
  return app;
}

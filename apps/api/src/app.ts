import type { PrismaClient } from '@app/db';
import type { ModelResolver } from '@app/pipeline';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Env } from './env';
import { documentsRoutes } from './modules/documents/routes';
import { healthRoutes } from './modules/health/routes';
import { presetsRoutes } from './modules/presets/routes';
import { providersRoutes } from './modules/providers/routes';
import { runEventsRoute } from './modules/runs/events-route';
import { registerErrorHandler } from './plugins/error-handler';
import { registerPrisma } from './plugins/prisma';
import type { EmbedManyFn } from './runtime/adapters/embedder';
import { createEventBus, type EventBus } from './runtime/event-bus';
import { createFileStorage, type FileStorage } from './storage/file-storage';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Injection point for mocks in API tests. */
export interface AiOverrides {
  modelResolver?: ModelResolver;
  embedManyFn?: EmbedManyFn;
}

export interface BuildAppOptions {
  env: Env;
  prisma?: PrismaClient;
  logger?: boolean;
  ai?: AiOverrides;
}

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    aiOverrides: AiOverrides;
    storage: FileStorage;
    eventBus: EventBus;
  }
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger === false ? false : { level: opts.env.LOG_LEVEL } });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', opts.env);
  app.decorate('aiOverrides', opts.ai ?? {});
  app.decorate('storage', createFileStorage(opts.env.UPLOAD_DIR));
  app.decorate('eventBus', createEventBus());
  registerErrorHandler(app);
  registerPrisma(app, { url: opts.env.DATABASE_URL, prisma: opts.prisma });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  await app.register(healthRoutes);
  await app.register(providersRoutes);
  await app.register(documentsRoutes);
  await app.register(presetsRoutes);
  await app.register(runEventsRoute);
  return app;
}

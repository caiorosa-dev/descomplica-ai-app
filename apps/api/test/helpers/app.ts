import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { type BuildAppOptions, buildApp } from '../../src/app';
import { type Env, loadEnv } from '../../src/env';
import { testPrisma } from './db';

export function testEnv(overrides: Partial<Env> = {}): Env {
  const base = loadEnv({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    OPENAI_API_KEY: 'test-openai-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'uploads-')),
    LOG_LEVEL: 'warn',
  });
  return { ...base, ...overrides };
}

export interface TestAppOverrides extends Omit<Partial<BuildAppOptions>, 'env'> {
  env?: Partial<Env>;
}

export async function createTestApp(overrides: TestAppOverrides = {}): Promise<FastifyInstance> {
  const { env, ...rest } = overrides;
  return buildApp({ prisma: testPrisma(), logger: false, ...rest, env: testEnv(env) });
}

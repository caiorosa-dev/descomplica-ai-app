import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    globalSetup: './test/global-setup.ts',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@localhost:5432/app_test',
    },
  },
});

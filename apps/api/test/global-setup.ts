import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Applies the migrations to the test database once per test run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(import.meta.dirname, '../../../packages/db'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}

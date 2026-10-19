import { isAbsolute, resolve } from 'node:path';
import { createPrismaClient, seed } from '@app/db';
import { loadEnv } from '../env';

/** Relative paths in .env are relative to where the command was started (the repo root under pnpm). */
const fromInvocation = (p: string) => (isAbsolute(p) ? p : resolve(process.env.INIT_CWD ?? process.cwd(), p));

const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);
try {
  const result = await seed(prisma, {
    uploadDir: fromInvocation(env.UPLOAD_DIR),
    corpusDir: fromInvocation(env.CORPUS_DIR),
    log: (m) => console.log(m),
  });
  console.log(`seed done: ${result.presets} presets, ${result.documents} documents`);
} finally {
  await prisma.$disconnect();
}

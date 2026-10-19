import { createPrismaClient, type PrismaClient } from '@app/db';

let client: PrismaClient | undefined;

/** One client per test file, pointed at TEST_DATABASE_URL. */
export function testPrisma(): PrismaClient {
  client ??= createPrismaClient(process.env.TEST_DATABASE_URL);
  return client;
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}

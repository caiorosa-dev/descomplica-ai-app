import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export function createPrismaClient(url: string | undefined = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error('DATABASE_URL is not set');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

let singleton: PrismaClient | undefined;

/** Lazily created client for `DATABASE_URL`; importing this module never opens a connection. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    singleton ??= createPrismaClient();
    const value = Reflect.get(singleton, property, singleton);
    return typeof value === 'function' ? value.bind(singleton) : value;
  },
});

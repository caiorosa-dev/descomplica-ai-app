import type { PrismaClient, RunStatus } from '@app/db';
import { parsePipelineConfig } from '@app/shared';

export async function createDocumentRow(prisma: PrismaClient, sha = crypto.randomUUID()) {
  return prisma.document.create({
    data: {
      filename: 'a.txt',
      mimeType: 'text/plain',
      sizeBytes: 3,
      sha256: sha,
      storagePath: `/tmp/${sha}.txt`,
      source: 'upload',
    },
  });
}

export async function createRunRow(prisma: PrismaClient, status: RunStatus = 'running') {
  const doc = await createDocumentRow(prisma);
  return prisma.run.create({ data: { documentId: doc.id, status, config: parsePipelineConfig({}), configHash: 'h' } });
}

export function parseSse(body: string): { id: string | null; event: string | null; data: unknown }[] {
  return body
    .split('\n\n')
    .filter((block) => block.trim() && !block.startsWith(':'))
    .map((block) => {
      const field = (name: string) =>
        block
          .split('\n')
          .find((l) => l.startsWith(`${name}: `))
          ?.slice(name.length + 2) ?? null;
      const data = field('data');
      return { id: field('id'), event: field('event'), data: data ? JSON.parse(data) : null };
    });
}

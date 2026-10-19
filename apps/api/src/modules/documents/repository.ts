import type { PrismaClient } from '@app/db';
import { type DocumentDto, DocumentType, type RunStatus } from '@app/shared';
import { z } from 'zod';

const documentInclude = {
  runs: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      status: true,
      stageRuns: {
        where: { stage: { in: ['text_extraction' as const, 'information_extraction' as const] } },
        select: { stage: true, output: true, reusedFrom: { select: { output: true } } },
      },
    },
  },
};

const PagesOutput = z.object({ stats: z.object({ pages: z.number().int() }) });
const TypeOutput = z.object({ classification: z.object({ documentType: DocumentType }) });

type DocumentRow = NonNullable<Awaited<ReturnType<typeof findDocument>>>;

function findDocument(prisma: PrismaClient, id: string) {
  return prisma.document.findUnique({ where: { id }, include: documentInclude });
}

export function toDocumentDto(row: DocumentRow): DocumentDto {
  const completed = row.runs.find((r) => r.status === 'completed');
  const outputOf = (stage: string) => {
    const sr = completed?.stageRuns.find((s) => s.stage === stage);
    return sr?.output ?? sr?.reusedFrom?.output ?? null;
  };
  const pages = PagesOutput.safeParse(outputOf('text_extraction'));
  const type = TypeOutput.safeParse(outputOf('information_extraction'));
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    source: row.source,
    corpusKey: row.corpusKey,
    createdAt: row.createdAt.toISOString(),
    detectedType: type.success ? type.data.classification.documentType : null,
    pages: pages.success ? pages.data.stats.pages : null,
    runCount: row.runs.length,
    lastRunStatus: (row.runs[0]?.status as RunStatus | undefined) ?? null,
  };
}

export function createDocumentsRepository(prisma: PrismaClient) {
  return {
    async get(id: string) {
      const row = await findDocument(prisma, id);
      return row ? toDocumentDto(row) : null;
    },
    async getRow(id: string) {
      return prisma.document.findUnique({ where: { id } });
    },
    async findBySha(sha256: string) {
      const row = await prisma.document.findUnique({ where: { sha256 }, include: documentInclude });
      return row ? toDocumentDto(row) : null;
    },
    async list() {
      const rows = await prisma.document.findMany({ orderBy: { createdAt: 'desc' }, include: documentInclude });
      return rows.map(toDocumentDto);
    },
    async create(data: { filename: string; mimeType: string; sizeBytes: number; sha256: string; storagePath: string }) {
      const row = await prisma.document.create({ data: { ...data, source: 'upload' }, include: documentInclude });
      return toDocumentDto(row);
    },
  };
}

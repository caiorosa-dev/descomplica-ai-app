import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { detectFormat } from '@app/pipeline';
import { BUILTIN_PRESETS, MIME_BY_FORMAT, parseCorpusManifest, parsePipelineConfig } from '@app/shared';
import type { PrismaClient } from './generated/prisma/client';
import { buildStoragePath } from './storage-path';

export interface SeedOptions {
  uploadDir: string;
  corpusDir: string;
  log?: (message: string) => void;
}

/**
 * Idempotent seed: upserts the builtin presets by slug (refreshing their configs) and the corpus documents by
 * sha256, copying each file into the upload directory. A missing corpus directory only skips the documents.
 */
export async function seed(prisma: PrismaClient, opts: SeedOptions): Promise<{ presets: number; documents: number }> {
  const log = opts.log ?? (() => {});
  for (const preset of BUILTIN_PRESETS) {
    const config = parsePipelineConfig(preset.config);
    await prisma.preset.upsert({
      where: { slug: preset.slug },
      create: { slug: preset.slug, name: preset.name, description: preset.description, config, isBuiltin: true },
      update: { name: preset.name, description: preset.description, config, isBuiltin: true },
    });
  }
  log(`seed: ${BUILTIN_PRESETS.length} builtin presets`);

  const manifestPath = join(opts.corpusDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    log(`seed: no corpus manifest at ${manifestPath}; skipping corpus documents`);
    return { presets: BUILTIN_PRESETS.length, documents: 0 };
  }
  const manifest = parseCorpusManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  await mkdir(opts.uploadDir, { recursive: true });
  for (const entry of manifest) {
    const buffer = await readFile(join(opts.corpusDir, entry.file));
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const format = await detectFormat(buffer, entry.file);
    const storagePath = buildStoragePath(opts.uploadDir, sha256, format);
    if (!existsSync(storagePath)) await writeFile(storagePath, buffer);
    const data = {
      filename: basename(entry.file),
      mimeType: MIME_BY_FORMAT[format],
      sizeBytes: buffer.byteLength,
      storagePath,
      source: 'corpus' as const,
      corpusKey: entry.key,
    };
    await prisma.document.upsert({ where: { sha256 }, create: { ...data, sha256 }, update: data });
  }
  log(`seed: ${manifest.length} corpus documents`);
  return { presets: BUILTIN_PRESETS.length, documents: manifest.length };
}

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { buildStoragePath } from '@app/db';

export interface FileStorage {
  save(buffer: Buffer, sha256: string, ext: string): Promise<string>;
  read(path: string): Promise<Buffer>;
  /** Deletes a stored file; paths outside the upload folder (such as corpus files) are left alone. */
  remove(path: string): Promise<void>;
}

/** Files are content-addressed (`<uploadDir>/<sha256>.<ext>`), so saving the same bytes twice is a no-op. */
export function createFileStorage(uploadDir: string): FileStorage {
  return {
    async save(buffer, sha256, ext) {
      await mkdir(uploadDir, { recursive: true });
      const path = buildStoragePath(uploadDir, sha256, ext);
      if (!existsSync(path)) await writeFile(path, buffer);
      return path;
    },
    read: (path) => readFile(path),
    async remove(path) {
      const rel = relative(resolve(uploadDir), resolve(path));
      if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return;
      await rm(path, { force: true });
    },
  };
}

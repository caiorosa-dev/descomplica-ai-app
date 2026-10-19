import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildStoragePath } from '@app/db';

export interface FileStorage {
  save(buffer: Buffer, sha256: string, ext: string): Promise<string>;
  read(path: string): Promise<Buffer>;
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
  };
}

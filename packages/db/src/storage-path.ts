export function buildStoragePath(uploadDir: string, sha256: string, extension: string): string {
  return `${uploadDir.replace(/\/+$/, '')}/${sha256}.${extension}`;
}

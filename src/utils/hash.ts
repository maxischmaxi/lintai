import { createHash } from "node:crypto";

export function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function computeCacheKey(
  filePath: string,
  contentHash: string,
  configHash: string,
): string {
  return `${filePath}:${contentHash}:${configHash}`;
}

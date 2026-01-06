import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { logger } from "../utils/logger.js";

// WASM files are stored in the user's cache directory
function getCacheDir(): string {
  const homeDir = process.env["HOME"] || process.env["USERPROFILE"] || "/tmp";
  return join(homeDir, ".cache", "lintai", "wasm");
}

const WASM_FILES = {
  treeSitter: {
    name: "tree-sitter.wasm",
    url: "https://unpkg.com/web-tree-sitter@0.22.6/tree-sitter.wasm",
  },
  typescript: {
    name: "tree-sitter-typescript.wasm",
    url: "https://unpkg.com/tree-sitter-typescript@0.23.2/tree-sitter-typescript.wasm",
  },
  tsx: {
    name: "tree-sitter-tsx.wasm",
    url: "https://unpkg.com/tree-sitter-typescript@0.23.2/tree-sitter-tsx.wasm",
  },
};

async function downloadFile(url: string, destPath: string): Promise<void> {
  logger.info(`Downloading ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = await response.arrayBuffer();
  const dir = dirname(destPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(destPath, Buffer.from(buffer));
  logger.info(`Downloaded ${destPath}`);
}

export async function ensureWasmFiles(): Promise<{
  treeSitterPath: string;
  typescriptPath: string;
  tsxPath: string;
}> {
  const cacheDir = getCacheDir();

  const treeSitterPath = join(cacheDir, WASM_FILES.treeSitter.name);
  const typescriptPath = join(cacheDir, WASM_FILES.typescript.name);
  const tsxPath = join(cacheDir, WASM_FILES.tsx.name);

  const downloads: Promise<void>[] = [];

  if (!existsSync(treeSitterPath)) {
    downloads.push(downloadFile(WASM_FILES.treeSitter.url, treeSitterPath));
  }

  if (!existsSync(typescriptPath)) {
    downloads.push(downloadFile(WASM_FILES.typescript.url, typescriptPath));
  }

  if (!existsSync(tsxPath)) {
    downloads.push(downloadFile(WASM_FILES.tsx.url, tsxPath));
  }

  if (downloads.length > 0) {
    logger.info("Downloading Tree-sitter WASM files (first run only)...");
    await Promise.all(downloads);
    logger.info("WASM files downloaded successfully");
  }

  return { treeSitterPath, typescriptPath, tsxPath };
}

export function getWasmPaths(): {
  treeSitterPath: string;
  typescriptPath: string;
  tsxPath: string;
} | null {
  const cacheDir = getCacheDir();

  const treeSitterPath = join(cacheDir, WASM_FILES.treeSitter.name);
  const typescriptPath = join(cacheDir, WASM_FILES.typescript.name);
  const tsxPath = join(cacheDir, WASM_FILES.tsx.name);

  if (
    existsSync(treeSitterPath) &&
    existsSync(typescriptPath) &&
    existsSync(tsxPath)
  ) {
    return { treeSitterPath, typescriptPath, tsxPath };
  }

  return null;
}

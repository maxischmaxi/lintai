import type { Tree } from "web-tree-sitter";
import type { Finding } from "../types/finding.js";
import { computeHash, computeCacheKey } from "../utils/hash.js";
import { logger } from "../utils/logger.js";

export interface DocumentEntry {
  uri: string;
  content: string;
  contentHash: string;
  tree: Tree | null;
  findings: Finding[];
  lastAnalyzed: number | null;
  analyzing: boolean;
}

export class DocumentStore {
  private documents: Map<string, DocumentEntry> = new Map();
  private findingsCache: Map<
    string,
    { findings: Finding[]; timestamp: number }
  > = new Map();
  private configHash: string = "";

  setConfigHash(hash: string): void {
    if (this.configHash !== hash) {
      // Config changed, invalidate all caches
      this.findingsCache.clear();
      this.configHash = hash;
      logger.debug("Config changed, cache invalidated");
    }
  }

  get(uri: string): DocumentEntry | undefined {
    return this.documents.get(uri);
  }

  set(uri: string, content: string): DocumentEntry {
    const contentHash = computeHash(content);
    const existing = this.documents.get(uri);

    // If content hasn't changed, keep existing entry
    if (existing && existing.contentHash === contentHash) {
      return existing;
    }

    const entry: DocumentEntry = {
      uri,
      content,
      contentHash,
      tree: null,
      findings: existing?.findings ?? [],
      lastAnalyzed: existing?.lastAnalyzed ?? null,
      analyzing: false,
    };

    this.documents.set(uri, entry);
    logger.debug(`Document updated: ${uri}`);
    return entry;
  }

  setTree(uri: string, tree: Tree): void {
    const entry = this.documents.get(uri);
    if (entry) {
      entry.tree = tree;
    }
  }

  setFindings(uri: string, findings: Finding[]): void {
    const entry = this.documents.get(uri);
    if (entry) {
      entry.findings = findings;
      entry.lastAnalyzed = Date.now();
      entry.analyzing = false;

      // Cache the findings
      const cacheKey = computeCacheKey(uri, entry.contentHash, this.configHash);
      this.findingsCache.set(cacheKey, {
        findings,
        timestamp: Date.now(),
      });
    }
  }

  setAnalyzing(uri: string, analyzing: boolean): void {
    const entry = this.documents.get(uri);
    if (entry) {
      entry.analyzing = analyzing;
    }
  }

  getCachedFindings(uri: string): Finding[] | null {
    const entry = this.documents.get(uri);
    if (!entry) return null;

    const cacheKey = computeCacheKey(uri, entry.contentHash, this.configHash);
    const cached = this.findingsCache.get(cacheKey);

    if (cached) {
      logger.debug(`Cache hit for ${uri}`);
      return cached.findings;
    }

    return null;
  }

  delete(uri: string): void {
    const entry = this.documents.get(uri);
    if (entry) {
      // Remove from findings cache
      const cacheKey = computeCacheKey(uri, entry.contentHash, this.configHash);
      this.findingsCache.delete(cacheKey);
    }
    this.documents.delete(uri);
    logger.debug(`Document removed: ${uri}`);
  }

  has(uri: string): boolean {
    return this.documents.has(uri);
  }

  getAllUris(): string[] {
    return Array.from(this.documents.keys());
  }

  clear(): void {
    this.documents.clear();
    this.findingsCache.clear();
  }

  /**
   * Clean up old cache entries (older than maxAge ms).
   */
  cleanCache(maxAge: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, value] of this.findingsCache) {
      if (now - value.timestamp > maxAge) {
        this.findingsCache.delete(key);
      }
    }
  }
}

// Singleton instance for LSP mode
let globalStore: DocumentStore | null = null;

export function getGlobalDocumentStore(): DocumentStore {
  if (!globalStore) {
    globalStore = new DocumentStore();
  }
  return globalStore;
}

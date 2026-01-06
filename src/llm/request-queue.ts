import { logger } from "../utils/logger.js";

interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  abortController: AbortController;
  timestamp: number;
}

/**
 * Request queue that processes one request at a time.
 * Optimized for local LLMs that can only handle one request.
 *
 * Features:
 * - Only one request processed at a time
 * - Newer requests for same file cancel older ones
 * - Stale requests are automatically cancelled
 */
export class RequestQueue {
  private queue: QueuedRequest<unknown>[] = [];
  private processing = false;
  private maxQueueAge = 30000; // 30 seconds max wait time

  /**
   * Add a request to the queue.
   * Returns a promise that resolves when the request completes.
   *
   * @param id - Unique ID for the request (e.g., file path)
   * @param execute - Function that executes the request
   * @param signal - Optional AbortSignal to cancel the request
   */
  async enqueue<T>(
    id: string,
    execute: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    // Cancel any existing requests for the same ID
    this.cancelById(id);

    // Clean up stale requests
    this.cleanupStaleRequests();

    return new Promise<T>((resolve, reject) => {
      const abortController = new AbortController();

      // If external signal aborts, cancel this request
      if (signal) {
        signal.addEventListener("abort", () => {
          abortController.abort();
          reject(new Error("Request cancelled"));
        });
      }

      const request: QueuedRequest<T> = {
        id,
        execute,
        resolve: resolve as (value: unknown) => void,
        reject,
        abortController,
        timestamp: Date.now(),
      };

      this.queue.push(request as QueuedRequest<unknown>);
      logger.debug(`Request queued: ${id} (queue size: ${this.queue.length})`);

      this.processNext();
    });
  }

  /**
   * Cancel all pending requests for a given ID.
   */
  cancelById(id: string): void {
    const toCancel = this.queue.filter((r) => r.id === id);
    for (const request of toCancel) {
      request.abortController.abort();
      request.reject(new Error("Request superseded by newer request"));
    }
    this.queue = this.queue.filter((r) => r.id !== id);

    if (toCancel.length > 0) {
      logger.debug(
        `Cancelled ${toCancel.length} pending request(s) for: ${id}`,
      );
    }
  }

  /**
   * Cancel all pending requests.
   */
  cancelAll(): void {
    for (const request of this.queue) {
      request.abortController.abort();
      request.reject(new Error("All requests cancelled"));
    }
    this.queue = [];
    logger.debug("All pending requests cancelled");
  }

  /**
   * Get current queue size.
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Check if currently processing a request.
   */
  get isProcessing(): boolean {
    return this.processing;
  }

  private cleanupStaleRequests(): void {
    const now = Date.now();
    const stale = this.queue.filter(
      (r) => now - r.timestamp > this.maxQueueAge,
    );

    for (const request of stale) {
      request.reject(new Error("Request timed out in queue"));
    }

    if (stale.length > 0) {
      this.queue = this.queue.filter(
        (r) => now - r.timestamp <= this.maxQueueAge,
      );
      logger.debug(`Cleaned up ${stale.length} stale request(s)`);
    }
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const request = this.queue.shift()!;

    try {
      // Check if request was aborted while waiting
      if (request.abortController.signal.aborted) {
        request.reject(new Error("Request cancelled"));
        return;
      }

      logger.debug(`Processing request: ${request.id}`);
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.processing = false;
      // Process next request if any
      this.processNext();
    }
  }
}

// Global request queue instance
let globalQueue: RequestQueue | null = null;

export function getGlobalRequestQueue(): RequestQueue {
  if (!globalQueue) {
    globalQueue = new RequestQueue();
  }
  return globalQueue;
}

export function resetGlobalRequestQueue(): void {
  if (globalQueue) {
    globalQueue.cancelAll();
  }
  globalQueue = null;
}

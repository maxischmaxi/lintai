import { logger } from "../utils/logger.js";

interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

/**
 * Simple token bucket rate limiter.
 */
export class RateLimiter {
  private maxTokens: number;
  private refillRate: number; // tokens per millisecond
  private state: RateLimitState;

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60000; // Convert to per millisecond
    this.state = {
      tokens: requestsPerMinute,
      lastRefill: Date.now(),
    };
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.state.lastRefill;
    const newTokens = elapsed * this.refillRate;

    this.state.tokens = Math.min(this.maxTokens, this.state.tokens + newTokens);
    this.state.lastRefill = now;
  }

  /**
   * Check if a request can be made immediately.
   */
  canRequest(): boolean {
    this.refillTokens();
    return this.state.tokens >= 1;
  }

  /**
   * Consume a token for a request.
   * Returns false if rate limited.
   */
  tryAcquire(): boolean {
    this.refillTokens();

    if (this.state.tokens >= 1) {
      this.state.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Wait until a request can be made, then consume the token.
   */
  async acquire(): Promise<void> {
    while (!this.tryAcquire()) {
      // Calculate wait time for next token
      const waitTime = Math.ceil((1 - this.state.tokens) / this.refillRate);
      logger.debug(`Rate limited, waiting ${waitTime}ms`);
      await sleep(Math.min(waitTime, 1000)); // Wait at most 1 second at a time
    }
  }

  /**
   * Get time until next request is allowed (in ms).
   */
  getWaitTime(): number {
    this.refillTokens();
    if (this.state.tokens >= 1) {
      return 0;
    }
    return Math.ceil((1 - this.state.tokens) / this.refillRate);
  }

  /**
   * Get current available tokens.
   */
  getAvailableTokens(): number {
    this.refillTokens();
    return Math.floor(this.state.tokens);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Global rate limiter instance
let globalRateLimiter: RateLimiter | null = null;

export function getGlobalRateLimiter(
  requestsPerMinute: number = 10,
): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(requestsPerMinute);
  }
  return globalRateLimiter;
}

export function resetGlobalRateLimiter(): void {
  globalRateLimiter = null;
}

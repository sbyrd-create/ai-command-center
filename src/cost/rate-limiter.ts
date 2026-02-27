import { rateLimit as defaultConfig, rateLimit } from "../config";
import { RateLimitConfig } from "../types";
import { RateLimitError } from "../utils/errors";

export class RateLimiter {
  private timestamps: number[] = [];
  private concurrent = 0;
  private config: RateLimitConfig;

  constructor(overrides?: Partial<RateLimitConfig>) {
    this.config = { ...defaultConfig, ...overrides };
  }

  async acquire(): Promise<() => void> {
    this.pruneOldTimestamps();

    if (this.timestamps.length >= this.config.maxRequestsPerMinute) {
      throw new RateLimitError(
        `Rate limit exceeded: ${this.timestamps.length}/${this.config.maxRequestsPerMinute} requests per minute`
      );
    }

    if (this.concurrent >= this.config.maxConcurrentRequests) {
      throw new RateLimitError(
        `Concurrency limit exceeded: ${this.concurrent}/${this.config.maxConcurrentRequests}`
      );
    }

    this.timestamps.push(Date.now());
    this.concurrent++;

    return () => {
      this.concurrent--;
    };
  }

  private pruneOldTimestamps(): void {
    const oneMinuteAgo = Date.now() - 60_000;
    this.timestamps = this.timestamps.filter((t) => t > oneMinuteAgo);
  }

  getStatus(): { requestsInWindow: number; concurrent: number } {
    this.pruneOldTimestamps();
    return {
      requestsInWindow: this.timestamps.length,
      concurrent: this.concurrent,
    };
  }
}

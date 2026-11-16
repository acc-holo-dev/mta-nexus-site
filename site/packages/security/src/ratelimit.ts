export interface RateLimiter {
  consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ success: boolean; remaining: number; resetAt: number }>;
}

export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; expiresAt: number }>();
  private operations = 0;

  constructor(
    private readonly maxKeys = 50_000,
    private readonly sweepInterval = 1_000,
  ) {
    if (maxKeys < 1 || sweepInterval < 1) {
      throw new RangeError("Rate limiter bounds must be positive");
    }
  }

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ success: boolean; remaining: number; resetAt: number }> {
    if (limit < 1 || windowSeconds < 1) {
      throw new RangeError("Rate limit and window must be positive");
    }

    const now = Date.now();
    this.maintain(now, key);
    const existing = this.hits.get(key);

    if (!existing || existing.expiresAt <= now) {
      const resetAt = now + windowSeconds * 1000;
      this.hits.set(key, { count: 1, expiresAt: resetAt });
      return { success: true, remaining: limit - 1, resetAt };
    }

    if (existing.count >= limit) {
      return { success: false, remaining: 0, resetAt: existing.expiresAt };
    }

    existing.count += 1;
    return { success: true, remaining: limit - existing.count, resetAt: existing.expiresAt };
  }

  private maintain(now: number, incomingKey: string): void {
    this.operations += 1;
    if (this.operations % this.sweepInterval === 0) {
      this.sweepExpired(now);
    }

    if (!this.hits.has(incomingKey) && this.hits.size >= this.maxKeys) {
      this.sweepExpired(now);
      while (this.hits.size >= this.maxKeys) {
        const oldestKey = this.hits.keys().next().value as string | undefined;
        if (!oldestKey) break;
        this.hits.delete(oldestKey);
      }
    }
  }

  private sweepExpired(now: number): void {
    for (const [key, hit] of this.hits) {
      if (hit.expiresAt <= now) this.hits.delete(key);
    }
  }
}

export const rateLimiter = new MemoryRateLimiter();

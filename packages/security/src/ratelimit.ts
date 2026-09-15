export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<{ success: boolean; remaining: number; resetAt: number }>;
}

export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; expiresAt: number }>();

  async consume(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ success: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
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
}

export const rateLimiter = new MemoryRateLimiter();

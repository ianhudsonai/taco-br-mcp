/** Decides whether a client may make one more request right now. */
export interface RateLimiter {
  allow(key: string): boolean | Promise<boolean>;
}

/**
 * Fixed-window counter kept in process memory. Good enough for a single Node
 * process (`--http`); the Worker uses Cloudflare's own rate limiting binding.
 */
export function createMemoryRateLimiter(limit: number, windowMs: number): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  let lastSweep = Date.now();
  return {
    allow(key) {
      const now = Date.now();
      if (now - lastSweep > windowMs) {
        for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
        lastSweep = now;
      }
      const w = windows.get(key);
      if (!w || now - w.start >= windowMs) {
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      w.count += 1;
      return w.count <= limit;
    }
  };
}

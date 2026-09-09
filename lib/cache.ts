/**
 * In-Memory Server-Side Cache Layer & In-Flight Request Deduplicator.
 *
 * ARCHITECTURAL DEPLOYMENT LIMITATION:
 * This cache is process-local and memory-bound. It is designed specifically for this
 * assignment's single-node/local environment without introducing heavy external
 * infrastructure like Redis.
 *
 * Important operational limitations:
 * 1. Process-local: Cache state is not shared across multi-instance serverless deployments (e.g. Vercel lambdas).
 * 2. Volatile: Cache resets upon server restart or process recycling.
 * 3. Scope: Provides protection against external provider rate limits and redundant duplicate calls.
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: string;
  expiresAt: number; // epoch ms
}

/**
 * Default Cache Configuration
 */
export const CACHE_CONFIG = {
  // Normal cache TTL for successful market quotes (60 seconds)
  MARKET_DATA_CACHE_TTL_MS: 60 * 1000,

  // Short negative-cache TTL for transient failures (10 seconds)
  // Prevents repeated hammering of failing endpoints while allowing quick recovery
  NEGATIVE_CACHE_TTL_MS: 10 * 1000,
};

export class MemoryCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  // Stores last known good values to support stale-on-error fallback even after expiration
  private readonly lastKnownGood = new Map<string, CacheEntry<unknown>>();
  private hitCount = 0;
  private missCount = 0;

  /**
   * Retrieves fresh cached value. Returns null if missing or expired.
   */
  get<T>(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      // Expired: remove from active fresh entries
      this.entries.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.value as T;
  }

  /**
   * Retrieves the raw cache entry including createdAt and expiresAt if fresh.
   */
  getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry as CacheEntry<T>;
  }

  /**
   * Stale-on-Error Fallback:
   * Retrieves the last known successful data even if the active cache entry expired.
   * Does NOT get overwritten by transient error negative caches.
   */
  getStale<T>(key: string): { value: T; createdAt: string; isStale: boolean } | null {
    // 1. If currently fresh in active cache, return as non-stale
    const freshEntry = this.getEntry<T>(key);
    if (freshEntry) {
      return {
        value: freshEntry.value,
        createdAt: freshEntry.createdAt,
        isStale: false,
      };
    }

    // 2. Otherwise check last known good value
    const lastGood = this.lastKnownGood.get(key);
    if (lastGood) {
      return {
        value: lastGood.value as T,
        createdAt: lastGood.createdAt,
        isStale: true,
      };
    }

    return null;
  }

  /**
   * Sets a successful value in the cache.
   * Also records it in the lastKnownGood store for stale-on-error resilience.
   */
  set<T>(key: string, value: T, ttlMs: number = CACHE_CONFIG.MARKET_DATA_CACHE_TTL_MS): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + ttlMs,
    };

    this.entries.set(key, entry as CacheEntry<unknown>);
    this.lastKnownGood.set(key, entry as CacheEntry<unknown>);
  }

  /**
   * Records a transient negative cache entry (short TTL).
   * Crucial rule: Does NOT overwrite any existing lastKnownGood entry.
   */
  setNegative<T>(key: string, value: T, ttlMs: number = CACHE_CONFIG.NEGATIVE_CACHE_TTL_MS): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + ttlMs,
    };

    this.entries.set(key, entry as CacheEntry<unknown>);
    // Notice: lastKnownGood is deliberately NOT overwritten with errors!
  }

  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const res1 = this.entries.delete(key);
    const res2 = this.lastKnownGood.delete(key);
    return res1 || res2;
  }

  clear(): void {
    this.entries.clear();
    this.lastKnownGood.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  getStats(): { hits: number; misses: number; size: number } {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      size: this.entries.size,
    };
  }
}

/**
 * In-Flight Request Deduplicator.
 * If multiple requests for the same stock arrive simultaneously while the cache is empty,
 * all callers await the same running Promise instead of firing redundant external HTTP requests.
 */
export class RequestDeduplicator {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /**
   * Deduplicates concurrent calls for the specified key.
   */
  async deduplicate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fetcher().finally(() => {
      // Ensure settled/rejected promises are removed so future calls aren't blocked
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  get activeCount(): number {
    return this.inFlight.size;
  }
}

// Singleton instances for backend services
export const marketCache = new MemoryCache();
export const requestDeduplicator = new RequestDeduplicator();

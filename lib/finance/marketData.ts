import { StockMarketData, MarketProviderError } from '@/types/market';
import { IMarketQuoteProvider, IValuationProvider, ProviderRequestOptions } from './types';
import { YahooQuoteProvider } from './yahoo';
import { GoogleValuationProvider, toGoogleSymbol } from './google';
import { toYahooSymbol } from '@/lib/portfolio/normalization';
import { MemoryCache, RequestDeduplicator, CACHE_CONFIG, marketCache, requestDeduplicator } from '@/lib/cache';
import { financeLogger } from './logger';
import { validateMarketPrice } from './marketValidation';

export interface BatchMarketDataResult {
  data: StockMarketData[];
  errors: MarketProviderError[];
  coverage: number; // percentage (0 - 100)
  timestamp: string;
  isStale?: boolean;
}

/**
 * Market Data Service Orchestrator.
 *
 * Implements:
 * 1. Server-side caching (60s TTL for success, 10s negative cache for errors)
 * 2. In-flight request deduplication across concurrent callers
 * 3. Stale-on-error fallback preserving last known good data when provider fails
 * 4. Controlled batch concurrency (default chunk size: 5)
 * 5. Partial failure matrix isolation
 */
export class MarketDataService {
  private readonly quoteProvider: IMarketQuoteProvider;
  private readonly valuationProvider: IValuationProvider;
  private readonly cache: MemoryCache;
  private readonly deduplicator: RequestDeduplicator;

  constructor(
    quoteProvider?: IMarketQuoteProvider,
    valuationProvider?: IValuationProvider,
    cache?: MemoryCache,
    deduplicator?: RequestDeduplicator
  ) {
    this.quoteProvider = quoteProvider ?? new YahooQuoteProvider();
    this.valuationProvider = valuationProvider ?? new GoogleValuationProvider();
    this.cache = cache ?? marketCache;
    this.deduplicator = deduplicator ?? requestDeduplicator;
  }

  /**
   * Retrieves and merges market data for a single holding.
   * Checks fresh cache -> deduplicates in-flight calls -> fetches providers -> falls back to stale on error.
   */
  async getStockMarketData(
    symbol: string,
    exchangeCode: string,
    options?: ProviderRequestOptions
  ): Promise<StockMarketData> {
    const stockCacheKey = `stock:${exchangeCode || symbol}`;

    // 1. Check active fresh cache
    const cached = this.cache.get<StockMarketData>(stockCacheKey);
    if (cached) {
      const validation = validateMarketPrice(cached.cmp);
      if (!validation.isValid) {
        financeLogger.warn('MarketData', `Evicting invalid cached CMP for ${stockCacheKey}: ${cached.cmp}`);
        this.cache.delete(stockCacheKey);
      } else {
        financeLogger.info('MarketData', `Cache HIT for ${stockCacheKey}`);
        return cached;
      }
    }

    // 2. In-Flight Request Deduplication
    return this.deduplicator.deduplicate(stockCacheKey, async () => {
      // Re-check cache inside deduplication closure in case a parallel call just primed it
      const freshCheck = this.cache.get<StockMarketData>(stockCacheKey);
      if (freshCheck) {
        return freshCheck;
      }

      financeLogger.info('MarketData', `Cache MISS for ${stockCacheKey} - executing provider query`);
      return this.fetchAndAssembleMarketData(symbol, exchangeCode, stockCacheKey, options);
    });
  }

  /**
   * Internal worker: executes concurrent provider calls and handles stale fallback.
   */
  private async fetchAndAssembleMarketData(
    symbol: string,
    exchangeCode: string,
    stockCacheKey: string,
    options?: ProviderRequestOptions
  ): Promise<StockMarketData> {
    const retrievalTime = new Date().toISOString();
    const yahooSymbol = toYahooSymbol(exchangeCode || symbol);
    const googleSymbol = toGoogleSymbol(exchangeCode || symbol);

    const quoteCacheKey = `yahoo:quote:${yahooSymbol}`;
    const valCacheKey = `google:val:${googleSymbol}`;

    // Run independent provider operations in parallel
    const [quoteResult, valResult] = await Promise.allSettled([
      this.quoteProvider.getQuote(symbol, exchangeCode, options),
      this.valuationProvider.getValuation(symbol, exchangeCode, options),
    ]);

    const errors: MarketProviderError[] = [];
    let isStale = false;

    // ----------------------------------------------------
    // 1. Process Yahoo Quote
    // ----------------------------------------------------
    let cmp: number | null = null;
    let quoteSource: string | undefined = undefined;

    if (quoteResult.status === 'fulfilled') {
      const quote = quoteResult.value;
      const validation = validateMarketPrice(quote.cmp);
      if (validation.isValid && validation.sanitizedCmp !== null) {
        cmp = validation.sanitizedCmp;
        quoteSource = quote.source;
        // Cache successful quote
        this.cache.set(quoteCacheKey, quote, CACHE_CONFIG.MARKET_DATA_CACHE_TTL_MS);
      } else {
        if (quote.cmp !== null) {
          financeLogger.warn('MarketData', `Rejected invalid quote CMP for ${exchangeCode}: ${quote.cmp} (${validation.reason})`);
          errors.push({
            code: 'DATA_UNAVAILABLE',
            message: `Market price failed validation: ${validation.reason}`,
            provider: 'YAHOO',
            timestamp: retrievalTime,
          });
        }
        // Quote returned an error / null
        if (quote.error) errors.push(quote.error);
        // Stale-on-Error Fallback: check if we have a last known good quote
        const staleQuote = this.cache.getStale<{ cmp: number }>(quoteCacheKey);
        const staleValidation = validateMarketPrice(staleQuote?.value?.cmp);
        if (staleValidation.isValid && staleValidation.sanitizedCmp !== null) {
          cmp = staleValidation.sanitizedCmp;
          quoteSource = 'YAHOO_STALE';
          isStale = true;
          financeLogger.warn('MarketData', `Using stale-on-error fallback quote for ${yahooSymbol}: ₹${cmp}`);
        } else {
          // Negative cache for temporary error (10s)
          this.cache.setNegative(quoteCacheKey, quote, CACHE_CONFIG.NEGATIVE_CACHE_TTL_MS);
        }
      }
    } else {
      const err: MarketProviderError = {
        code: 'PROVIDER_UNAVAILABLE',
        message: quoteResult.reason instanceof Error ? quoteResult.reason.message : 'Yahoo quote provider crashed',
        provider: 'YAHOO',
        timestamp: retrievalTime,
      };
      errors.push(err);

      // Stale-on-Error Fallback
      const staleQuote = this.cache.getStale<{ cmp: number }>(quoteCacheKey);
      if (staleQuote && staleQuote.value.cmp !== null) {
        cmp = staleQuote.value.cmp;
        quoteSource = 'YAHOO_STALE';
        isStale = true;
      }
    }

    // ----------------------------------------------------
    // 2. Process Google Valuation
    // ----------------------------------------------------
    let peRatio: number | null = null;
    let latestEarnings: number | null = null;
    let valuationSource: string | undefined = undefined;

    if (valResult.status === 'fulfilled') {
      const val = valResult.value;
      if (val.peRatio !== null || val.latestEarnings !== null) {
        peRatio = val.peRatio;
        latestEarnings = val.latestEarnings;
        valuationSource = val.source;
        this.cache.set(valCacheKey, val, CACHE_CONFIG.MARKET_DATA_CACHE_TTL_MS);
      } else {
        if (val.error) errors.push(val.error);

        // Stale-on-Error Fallback
        const staleVal = this.cache.getStale<{ peRatio: number | null; latestEarnings: number | null }>(valCacheKey);
        if (staleVal && (staleVal.value.peRatio !== null || staleVal.value.latestEarnings !== null)) {
          peRatio = staleVal.value.peRatio;
          latestEarnings = staleVal.value.latestEarnings;
          valuationSource = 'GOOGLE_STALE';
          isStale = true;
          financeLogger.warn('MarketData', `Using stale-on-error fallback valuation for ${googleSymbol}`);
        } else {
          this.cache.setNegative(valCacheKey, val, CACHE_CONFIG.NEGATIVE_CACHE_TTL_MS);
        }
      }
    } else {
      const err: MarketProviderError = {
        code: 'PROVIDER_UNAVAILABLE',
        message: valResult.reason instanceof Error ? valResult.reason.message : 'Google valuation provider crashed',
        provider: 'GOOGLE',
        timestamp: retrievalTime,
      };
      errors.push(err);

      const staleVal = this.cache.getStale<{ peRatio: number | null; latestEarnings: number | null }>(valCacheKey);
      if (staleVal && (staleVal.value.peRatio !== null || staleVal.value.latestEarnings !== null)) {
        peRatio = staleVal.value.peRatio;
        latestEarnings = staleVal.value.latestEarnings;
        valuationSource = 'GOOGLE_STALE';
        isStale = true;
      }
    }

    const assembled: StockMarketData = {
      symbol,
      exchangeCode,
      cmp,
      peRatio,
      latestEarnings,
      timestamp: retrievalTime,
      cachedAt: new Date().toISOString(),
      isStale: isStale ? true : undefined,
      errors: errors.length > 0 ? errors : undefined,
      quoteSource,
      valuationSource,
    };

    // Cache the combined record:
    // If at least CMP is present (either live or stale), apply 60s cache; otherwise apply 10s negative cache
    const ttl = cmp !== null ? CACHE_CONFIG.MARKET_DATA_CACHE_TTL_MS : CACHE_CONFIG.NEGATIVE_CACHE_TTL_MS;
    if (cmp !== null) {
      this.cache.set(stockCacheKey, assembled, ttl);
    } else {
      this.cache.setNegative(stockCacheKey, assembled, ttl);
    }

    return assembled;
  }

  /**
   * Retrieves market data for an entire portfolio in controlled parallel batches.
   * Utilizes cache hits immediately and batches remaining cache misses.
   */
  async getPortfolioMarketData(
    holdings: Array<{ name: string; exchangeCode: string }>,
    batchSize: number = 5,
    options?: ProviderRequestOptions
  ): Promise<BatchMarketDataResult> {
    const timestamp = new Date().toISOString();

    const allData: StockMarketData[] = [];
    const allErrors: MarketProviderError[] = [];
    const cacheMissHoldings: Array<{ name: string; exchangeCode: string }> = [];

    // 1. Separate items that hit fresh cache from those requiring provider calls
    for (const h of holdings) {
      const stockCacheKey = `stock:${h.exchangeCode || h.name}`;
      const cached = this.cache.get<StockMarketData>(stockCacheKey);
      if (cached) {
        allData.push(cached);
        if (cached.errors) {
          allErrors.push(...cached.errors);
        }
      } else {
        cacheMissHoldings.push(h);
      }
    }

    financeLogger.info(
      'MarketData',
      `Batch evaluation: ${allData.length} cached, ${cacheMissHoldings.length} to fetch`
    );

    // 2. Fetch cache misses in controlled batches
    for (let i = 0; i < cacheMissHoldings.length; i += batchSize) {
      const chunk = cacheMissHoldings.slice(i, i + batchSize);
      const chunkResults = await Promise.all(
        chunk.map((h) => this.getStockMarketData(h.name, h.exchangeCode, options))
      );

      for (const res of chunkResults) {
        allData.push(res);
        if (res.errors) {
          allErrors.push(...res.errors);
        }
      }
    }

    // Sort to restore original holding ordering
    const sortedData = holdings.map((h) => {
      const match = allData.find((d) => d.exchangeCode === h.exchangeCode && d.symbol === h.name);
      return match || {
        symbol: h.name,
        exchangeCode: h.exchangeCode,
        cmp: null,
        peRatio: null,
        latestEarnings: null,
        timestamp,
      };
    });

    const availableQuotes = sortedData.filter((d) => d.cmp !== null).length;
    const coverage = holdings.length > 0 ? Number(((availableQuotes / holdings.length) * 100).toFixed(2)) : 0;
    const hasAnyStale = sortedData.some((d) => d.isStale === true);

    return {
      data: sortedData,
      errors: allErrors,
      coverage,
      timestamp,
      isStale: hasAnyStale ? true : undefined,
    };
  }

  getCache(): MemoryCache {
    return this.cache;
  }
}

// Default application singleton
export const marketDataService = new MarketDataService();

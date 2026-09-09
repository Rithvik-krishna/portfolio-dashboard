import { MarketQuote, MarketProviderError } from '@/types/market';
import { IMarketQuoteProvider, ProviderRequestOptions } from './types';
import { toYahooSymbol } from '@/lib/portfolio/normalization';
import { financeLogger } from './logger';

/**
 * Yahoo Finance Quote Provider.
 *
 * NOTE & ACKNOWLEDGEMENT:
 * As required by the case study guidelines, Yahoo Finance does NOT provide an official
 * public API. This provider uses standard unofficial query endpoints and scraping
 * conventions. Consequently, rate limiting, structural changes, or network blocks
 * must be anticipated and handled defensively.
 */
export class YahooQuoteProvider implements IMarketQuoteProvider {
  readonly providerName = 'YAHOO';
  private readonly defaultTimeoutMs: number;

  constructor(defaultTimeoutMs: number = 5000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Fetches the Current Market Price (CMP) for an exchange code or ticker.
   */
  async getQuote(
    symbol: string,
    exchangeCode: string,
    options?: ProviderRequestOptions
  ): Promise<MarketQuote> {
    const timestamp = new Date().toISOString();
    const yahooSymbol = toYahooSymbol(exchangeCode || symbol);

    if (!yahooSymbol) {
      return {
        symbol,
        exchangeCode,
        yahooSymbol: '',
        cmp: null,
        timestamp,
        source: 'YAHOO',
        error: {
          code: 'INVALID_SYMBOL',
          message: `Cannot resolve valid Yahoo symbol for code "${exchangeCode}"`,
          provider: 'YAHOO',
          timestamp,
        },
      };
    }

    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external signal if supplied
    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      financeLogger.info('Yahoo', `Fetching quote for ${yahooSymbol}`);

      // Unofficial Yahoo Finance v8 chart query endpoint (widely supported and lightweight)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSymbol
      )}?interval=1d&range=1d`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        return this.createErrorQuote(symbol, exchangeCode, yahooSymbol, timestamp, {
          code: 'RATE_LIMITED',
          message: `Yahoo Finance rate limited request for ${yahooSymbol}`,
          provider: 'YAHOO',
          timestamp,
        });
      }

      if (response.status === 404) {
        return this.createErrorQuote(symbol, exchangeCode, yahooSymbol, timestamp, {
          code: 'INVALID_SYMBOL',
          message: `Symbol ${yahooSymbol} not found on Yahoo Finance`,
          provider: 'YAHOO',
          timestamp,
        });
      }

      if (!response.ok) {
        return this.createErrorQuote(symbol, exchangeCode, yahooSymbol, timestamp, {
          code: 'PROVIDER_UNAVAILABLE',
          message: `Yahoo Finance responded with HTTP status ${response.status}`,
          provider: 'YAHOO',
          timestamp,
        });
      }

      const json = await response.json();
      const meta = json?.chart?.result?.[0]?.meta;

      if (!meta) {
        return this.createErrorQuote(symbol, exchangeCode, yahooSymbol, timestamp, {
          code: 'INVALID_RESPONSE',
          message: `Unexpected response structure from Yahoo Finance for ${yahooSymbol}`,
          provider: 'YAHOO',
          timestamp,
        });
      }

      // regularMarketPrice is the primary current market price
      const cmp =
        typeof meta.regularMarketPrice === 'number' &&
        !isNaN(meta.regularMarketPrice) &&
        isFinite(meta.regularMarketPrice) &&
        meta.regularMarketPrice >= 0
          ? meta.regularMarketPrice
          : null;

      if (cmp === null) {
        return this.createErrorQuote(symbol, exchangeCode, yahooSymbol, timestamp, {
          code: 'DATA_UNAVAILABLE',
          message: `Market price is not currently available for ${yahooSymbol}`,
          provider: 'YAHOO',
          timestamp,
        });
      }

      financeLogger.info('Yahoo', `Successfully retrieved CMP for ${yahooSymbol}: ₹${cmp}`);

      return {
        symbol,
        exchangeCode,
        yahooSymbol,
        cmp,
        currency: meta.currency || 'INR',
        timestamp,
        source: 'YAHOO',
        error: null,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));

      const error: MarketProviderError = {
        code: isAbort ? 'TIMEOUT' : 'PROVIDER_UNAVAILABLE',
        message: isAbort
          ? `Yahoo Finance request timed out after ${timeoutMs}ms for ${yahooSymbol}`
          : err instanceof Error
          ? err.message
          : 'Unknown error fetching Yahoo quote',
        provider: 'YAHOO',
        timestamp,
      };

      financeLogger.warn('Yahoo', `Failed to fetch quote for ${yahooSymbol}`, { error: error.code });
      return this.createErrorQuote(symbol, exchangeCode, yahooSymbol, timestamp, error);
    }
  }

  /**
   * Fetches multiple quotes sequentially or in controlled parallel execution.
   */
  async getQuotes(
    items: Array<{ symbol: string; exchangeCode: string }>,
    options?: ProviderRequestOptions
  ): Promise<MarketQuote[]> {
    return Promise.all(items.map((item) => this.getQuote(item.symbol, item.exchangeCode, options)));
  }

  private createErrorQuote(
    symbol: string,
    exchangeCode: string,
    yahooSymbol: string,
    timestamp: string,
    error: MarketProviderError
  ): MarketQuote {
    return {
      symbol,
      exchangeCode,
      yahooSymbol,
      cmp: null,
      timestamp,
      source: 'YAHOO',
      error,
    };
  }
}

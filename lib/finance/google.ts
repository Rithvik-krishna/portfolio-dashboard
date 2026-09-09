import { ValuationMetrics, MarketProviderError } from '@/types/market';
import { IValuationProvider, ProviderRequestOptions } from './types';
import { financeLogger } from './logger';

/**
 * Converts a stock exchange code into a Google Finance qualified symbol:
 * - 6-digit numeric BSE security codes (e.g., "532174") -> "532174:BOM"
 * - Alphabetic NSE tickers (e.g., "HDFCBANK") -> "HDFCBANK:NSE"
 * - Explicitly qualified tickers (e.g., "TCS:NSE") -> preserved
 */
export function toGoogleSymbol(exchangeCode: string): string {
  if (!exchangeCode) return '';
  const trimmed = exchangeCode.trim().toUpperCase();

  if (trimmed.includes(':')) {
    return trimmed;
  }

  // 6-digit numeric string is a BSE security code -> BOM exchange on Google Finance
  if (/^\d{6}$/.test(trimmed)) {
    return `${trimmed}:BOM`;
  }

  // Alphabetic ticker -> NSE exchange on Google Finance
  if (/^[A-Z0-9\-]+$/.test(trimmed)) {
    return `${trimmed}:NSE`;
  }

  return trimmed;
}

/**
 * Google Finance Valuation Provider.
 *
 * NOTE & ACKNOWLEDGEMENT:
 * Google Finance does NOT provide an official public API.
 * This provider uses lightweight, server-side HTTP extraction targeting
 * https://www.google.com/finance/quote/{symbol}:{exchange}.
 *
 * It is subject to anti-bot behavior, page structure modifications, and rate limits.
 * All extraction is performed defensively with strict null-propagation.
 *
 * LATEST EARNINGS SEMANTICS:
 * Google Finance displays Earnings Per Share (EPS) in its primary key metrics grid.
 * This provider extracts the reported EPS figure and maps it to the
 * ValuationMetrics.latestEarnings field.
 */
export class GoogleValuationProvider implements IValuationProvider {
  readonly providerName = 'GOOGLE';
  private readonly defaultTimeoutMs: number;

  constructor(defaultTimeoutMs: number = 5000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async getValuation(
    symbol: string,
    exchangeCode: string,
    options?: ProviderRequestOptions
  ): Promise<ValuationMetrics> {
    const timestamp = new Date().toISOString();
    const googleSymbol = toGoogleSymbol(exchangeCode || symbol);

    if (!googleSymbol) {
      return this.createErrorValuation(symbol, exchangeCode, '', timestamp, {
        code: 'INVALID_SYMBOL',
        message: `Cannot resolve valid Google Finance symbol for "${exchangeCode || symbol}"`,
        provider: 'GOOGLE',
        timestamp,
      });
    }

    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      financeLogger.info('Google', `Fetching valuation metrics for ${googleSymbol}`);

      const url = `https://www.google.com/finance/quote/${encodeURIComponent(googleSymbol)}`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        return this.createErrorValuation(symbol, exchangeCode, googleSymbol, timestamp, {
          code: 'RATE_LIMITED',
          message: `Google Finance rate-limited request for ${googleSymbol}`,
          provider: 'GOOGLE',
          timestamp,
        });
      }

      if (response.status === 404) {
        return this.createErrorValuation(symbol, exchangeCode, googleSymbol, timestamp, {
          code: 'INVALID_SYMBOL',
          message: `Symbol ${googleSymbol} not found on Google Finance`,
          provider: 'GOOGLE',
          timestamp,
        });
      }

      if (!response.ok) {
        return this.createErrorValuation(symbol, exchangeCode, googleSymbol, timestamp, {
          code: 'PROVIDER_UNAVAILABLE',
          message: `Google Finance returned HTTP status ${response.status}`,
          provider: 'GOOGLE',
          timestamp,
        });
      }

      const html = await response.text();

      // Defensive Regex Extraction:
      // Google Finance displays key statistics in elements structured like:
      // <div class="...">P/E ratio</div>\s*<div class="...">18.52</div>
      // <div class="...">EPS</div>\s*<div class="...">51.21</div>
      const pe = this.extractNumericMetric(html, /P\/E ratio<\/div>\s*<div class="[^"]*">([0-9.,\-]+)<\/div>/i);
      const eps = this.extractNumericMetric(html, /EPS<\/div>\s*<div class="[^"]*">([0-9.,\-]+)<\/div>/i);

      if (pe === null && eps === null) {
        return this.createErrorValuation(symbol, exchangeCode, googleSymbol, timestamp, {
          code: 'DATA_UNAVAILABLE',
          message: `Neither P/E ratio nor EPS could be extracted for ${googleSymbol}`,
          provider: 'GOOGLE',
          timestamp,
        });
      }

      financeLogger.info('Google', `Retrieved valuation for ${googleSymbol}: PE=${pe}, EPS=${eps}`);

      return {
        symbol,
        exchangeCode,
        googleSymbol,
        peRatio: pe,
        latestEarnings: eps,
        timestamp,
        source: 'GOOGLE',
        error: null,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));

      const error: MarketProviderError = {
        code: isAbort ? 'TIMEOUT' : 'PROVIDER_UNAVAILABLE',
        message: isAbort
          ? `Google Finance request timed out after ${timeoutMs}ms for ${googleSymbol}`
          : err instanceof Error
          ? err.message
          : 'Unknown error fetching Google valuation',
        provider: 'GOOGLE',
        timestamp,
      };

      financeLogger.warn('Google', `Failed to fetch valuation for ${googleSymbol}`, { error: error.code });
      return this.createErrorValuation(symbol, exchangeCode, googleSymbol, timestamp, error);
    }
  }

  async getValuations(
    items: Array<{ symbol: string; exchangeCode: string }>,
    options?: ProviderRequestOptions
  ): Promise<ValuationMetrics[]> {
    return Promise.all(items.map((item) => this.getValuation(item.symbol, item.exchangeCode, options)));
  }

  /**
   * Defensively extracts and validates a floating-point numeric metric from HTML.
   * Returns null if missing, empty, "-", NaN, or non-finite.
   * NEVER converts missing metric to 0.
   */
  private extractNumericMetric(html: string, regex: RegExp): number | null {
    const match = regex.exec(html);
    if (!match || !match[1]) return null;

    const raw = match[1].replace(/,/g, '').trim();
    if (!raw || raw === '-' || raw === 'N/A') return null;

    const parsed = parseFloat(raw);
    if (isNaN(parsed) || !isFinite(parsed)) return null;

    return parsed;
  }

  private createErrorValuation(
    symbol: string,
    exchangeCode: string,
    googleSymbol: string,
    timestamp: string,
    error: MarketProviderError
  ): ValuationMetrics {
    return {
      symbol,
      exchangeCode,
      googleSymbol,
      peRatio: null,
      latestEarnings: null,
      timestamp,
      source: 'GOOGLE',
      error,
    };
  }
}

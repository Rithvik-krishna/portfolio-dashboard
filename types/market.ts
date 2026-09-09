/**
 * Standardized market error codes.
 */
export type MarketErrorCode =
  | 'INVALID_SYMBOL'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'INVALID_RESPONSE'
  | 'DATA_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

/**
 * Structured provider error model.
 * Prevents leaking raw stack traces to client while keeping detailed diagnostics.
 */
export interface MarketProviderError {
  code: MarketErrorCode;
  message: string;
  provider: 'YAHOO' | 'GOOGLE' | 'SYSTEM';
  details?: unknown;
  timestamp: string;
}

/**
 * Current Market Price (CMP) quote representation.
 * Retrieved from market quote providers (e.g., Yahoo Finance).
 */
export interface MarketQuote {
  symbol: string;
  exchangeCode: string;
  yahooSymbol: string;
  cmp: number | null;
  currency?: string;
  timestamp: string; // Time quote was retrieved from provider
  source: 'YAHOO';
  error?: MarketProviderError | null;
  isStale?: boolean;
}

/**
 * Valuation and earnings metrics.
 * Retrieved from valuation providers (e.g., Google Finance).
 *
 * NOTE ON LATEST EARNINGS SEMANTICS:
 * Google Finance does not provide a separate standardized total earnings field.
 * The metric extracted from Google Finance is Earnings Per Share (EPS), which
 * maps to latestEarnings in the StockMarketData model.
 */
export interface ValuationMetrics {
  symbol: string;
  exchangeCode: string;
  googleSymbol: string;
  peRatio: number | null;
  latestEarnings: number | null; // Extracted from Google Finance EPS
  timestamp: string; // Time valuation was retrieved from provider
  source: 'GOOGLE';
  error?: MarketProviderError | null;
  isStale?: boolean;
}

/**
 * Combined live stock market data for a holding.
 * Combines CMP from quote provider with valuation metrics from valuation provider.
 */
export interface StockMarketData {
  symbol: string;
  exchangeCode: string;
  cmp: number | null;
  peRatio: number | null;
  latestEarnings: number | null; // Normalized from Google Finance EPS
  timestamp: string; // Provider data retrieval timestamp
  cachedAt?: string; // Time this entry was written to server cache
  isStale?: boolean; // True if returned from stale-on-error fallback
  errors?: MarketProviderError[];
  quoteSource?: string;
  valuationSource?: string;
}

/**
 * Response payload for /api/market-data route.
 */
export interface MarketDataApiResponse {
  success: boolean;
  requestTimestamp: string; // Time the API request was received and processed
  data: StockMarketData[];
  errors: MarketProviderError[];
  coverage: number; // percentage (0 - 100) of holdings with valid CMP
  isStale?: boolean; // True if any items in payload are served from stale fallback
}

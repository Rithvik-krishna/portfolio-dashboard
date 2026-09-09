import { MarketQuote, ValuationMetrics } from '@/types/market';

/**
 * Common request options for provider calls.
 */
export interface ProviderRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Interface for Market Quote providers (e.g. Yahoo Finance).
 * Provides Current Market Price (CMP).
 */
export interface IMarketQuoteProvider {
  readonly providerName: string;
  getQuote(
    symbol: string,
    exchangeCode: string,
    options?: ProviderRequestOptions
  ): Promise<MarketQuote>;

  getQuotes(
    items: Array<{ symbol: string; exchangeCode: string }>,
    options?: ProviderRequestOptions
  ): Promise<MarketQuote[]>;
}

/**
 * Interface for Valuation providers (e.g. Google Finance).
 * Provides P/E ratio and latest earnings data.
 */
export interface IValuationProvider {
  readonly providerName: string;
  getValuation(
    symbol: string,
    exchangeCode: string,
    options?: ProviderRequestOptions
  ): Promise<ValuationMetrics>;

  getValuations(
    items: Array<{ symbol: string; exchangeCode: string }>,
    options?: ProviderRequestOptions
  ): Promise<ValuationMetrics[]>;
}

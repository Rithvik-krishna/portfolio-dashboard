/**
 * Portfolio Data Availability States
 * Models the lifecycle of market data hydration.
 */
export type PortfolioDataState =
  | 'SOURCE_ONLY'         // State 1: Only initial portfolio holdings data available (CMP/PE are null)
  | 'COMPLETE_MARKET'     // State 2: 100% of holdings have live market quotes
  | 'PARTIAL_MARKET'      // State 3: Some holdings have live quotes, others are pending/unavailable
  | 'PROVIDER_ERROR';     // State 4: Market feed failed completely (fallback to source data)

/**
 * Core portfolio holding entity
 * Represents an individual stock holding with purchase details,
 * calculated metrics, and market valuation indicators.
 */
export interface PortfolioHolding {
  id: string;
  name: string;
  purchasePrice: number;
  quantity: number;
  exchangeCode: string;
  sector: string;

  // Derived financial fields (calculated deterministically by calculation engine)
  investment?: number | null;
  portfolioWeight?: number | null;
  presentValue?: number | null;
  gainLoss?: number | null;
  gainLossPercentage?: number | null;

  // Market financial fields (fetched in future market integration phases)
  cmp?: number | null;
  peRatio?: number | null;
  latestEarnings?: string | number | null;
}

/**
 * Raw holding extracted directly from source before full normalization
 */
export interface RawPortfolioHolding {
  id?: string | number;
  name?: unknown;
  purchasePrice?: unknown;
  quantity?: unknown;
  exchangeCode?: unknown;
  sector?: unknown;
  rowNumber?: number;
}

/**
 * Summary metrics aggregated for a specific sector
 */
export interface SectorSummary {
  sector: string;
  totalInvestment: number;
  totalPresentValue: number | null;
  totalGainLoss: number | null;
  totalGainLossPercentage: number | null;
  holdingsCount: number;
  portfolioWeight: number;
  holdingsWithMarketData: number;
  marketDataCoverage: number; // percentage (0 - 100)
  isMarketDataComplete: boolean;
}

/**
 * High-level overall portfolio summary
 */
export interface PortfolioSummary {
  totalInvestment: number;
  totalPresentValue: number | null;
  totalGainLoss: number | null;
  totalGainLossPercentage: number | null;
  holdingCount: number;
  sectorCount: number;
  holdingsWithMarketData: number;
  marketDataCoverage: number; // percentage (0 - 100)
  isMarketDataComplete: boolean;
  dataState: PortfolioDataState;
}

/**
 * Result of validating a portfolio dataset
 */
export interface PortfolioValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalChecked: number;
}

import { PortfolioHolding, RawPortfolioHolding } from '@/types/portfolio';

export type ExchangeType = 'BSE' | 'NSE' | 'UNKNOWN';

/**
 * Normalizes a stock name:
 * - Trims leading and trailing whitespace
 * - Collapses consecutive internal spaces
 */
export function normalizeStockName(name: unknown): string {
  if (name == null) return '';
  return String(name).trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes a sector name:
 * - Trims whitespace
 * - Standardizes casing and naming
 */
export function normalizeSectorName(sector: unknown): string {
  if (sector == null) return 'Unclassified';
  const trimmed = String(sector).trim().replace(/\s+/g, ' ');
  return trimmed || 'Unclassified';
}

/**
 * Normalizes a stock ticker or exchange security code
 */
export function normalizeTicker(symbol: unknown): string {
  if (symbol == null) return '';
  return String(symbol).trim().toUpperCase();
}

/**
 * Identifies the stock exchange based on the symbol convention:
 * - 6-digit numeric string (e.g., "532174", "500400") -> BSE (Bombay Stock Exchange)
 * - Purely alphabetic string (e.g., "HDFCBANK", "BAJFINANCE") -> NSE (National Stock Exchange)
 */
export function detectExchange(code: string): ExchangeType {
  const normalized = normalizeTicker(code);
  if (/^\d{6}$/.test(normalized)) {
    return 'BSE';
  }
  if (/^[A-Z0-9\-]+$/.test(normalized) && !/^\d+$/.test(normalized)) {
    return 'NSE';
  }
  return 'UNKNOWN';
}

/**
 * Converts an exchange code to its Yahoo Finance compatible symbol:
 * - BSE scrip code -> "{code}.BO"
 * - NSE ticker -> "{code}.NS"
 * - Ambiguous / already dotted -> keeps as-is without blind double-suffixing
 */
export function toYahooSymbol(code: string): string {
  const normalized = normalizeTicker(code);
  if (!normalized) return '';

  if (normalized.includes('.')) {
    return normalized;
  }

  const exchange = detectExchange(normalized);
  if (exchange === 'BSE') {
    return `${normalized}.BO`;
  }
  if (exchange === 'NSE') {
    return `${normalized}.NS`;
  }

  // Fallback for unclassified
  return normalized;
}

/**
 * Safely parses any numeric input into a clean number or null:
 * - Removes currency symbols ('₹', '$', '€', '£')
 * - Strips commas ('1,490' -> 1490)
 * - Converts percentages ('15%' -> 15)
 * - Converts empty / undefined / null / '#N/A' / '-' to null
 * - Rejects and guards against NaN and Infinity
 */
export function parseNumericValue(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return null;
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-' || trimmed === 'NA' || trimmed === 'N/A' || trimmed.startsWith('#')) {
      return null;
    }

    // Handle percentage strings e.g. "12.5%"
    const isPercentage = trimmed.endsWith('%');
    const cleaned = trimmed
      .replace(/[₹$€£%,]/g, '')
      .trim();

    const parsed = Number(cleaned);
    if (isNaN(parsed) || !isFinite(parsed)) {
      return null;
    }

    return isPercentage ? parsed : parsed;
  }

  return null;
}

/**
 * Normalizes a raw holding record into a typed PortfolioHolding:
 * Preserves source data, sets un-fetched market fields to null.
 */
export function normalizeHolding(raw: RawPortfolioHolding, index: number): PortfolioHolding {
  const name = normalizeStockName(raw.name);
  const purchasePrice = parseNumericValue(raw.purchasePrice) ?? 0;
  const quantity = Math.round(parseNumericValue(raw.quantity) ?? 0);
  const exchangeCode = normalizeTicker(raw.exchangeCode);
  const sector = normalizeSectorName(raw.sector);
  const id = raw.id ? String(raw.id).trim() : `holding-${index + 1}`;

  return {
    id,
    name,
    purchasePrice,
    quantity,
    exchangeCode,
    sector,
    investment: null,
    portfolioWeight: null,
    presentValue: null,
    gainLoss: null,
    gainLossPercentage: null,
    cmp: null,
    peRatio: null,
    latestEarnings: null,
  };
}

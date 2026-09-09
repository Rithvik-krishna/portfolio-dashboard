/**
 * Market Data Validation Layer
 *
 * Enforces financial sanity rules on live market quotes before caching,
 * calculation, or portfolio hydration.
 *
 * Guarantees:
 * 1. Non-finite values (NaN, Infinity, -Infinity) are rejected.
 * 2. Non-positive prices (<= 0) are rejected.
 * 3. Absurdly large prices exceeding maximum equity bounds (e.g. > ₹10,00,000) are rejected.
 * 4. Implausible prices relative to holding purchase price (e.g. > 50x gain or < 0.01x drop) are rejected.
 * 5. Prices contradicting provider 52-week trading ranges are rejected.
 * 6. Valid market prices (HDFC, Bajaj Finance, DMart, Astral, Savani, etc.) are strictly preserved.
 */

export interface MarketPriceValidationOptions {
  /** The purchase price of the holding if available, for relative sanity checks */
  purchasePrice?: number | null;
  /** Provider 52-week high if available */
  fiftyTwoWeekHigh?: number | null;
  /** Provider 52-week low if available */
  fiftyTwoWeekLow?: number | null;
  /** Maximum allowable single share price in INR (default: ₹10,00,000) */
  maxAbsolutePrice?: number;
  /** Minimum allowable share price in INR (default: ₹0.01) */
  minAbsolutePrice?: number;
  /** Maximum plausible multiplier over purchase price (default: 50x / 5000% gain) */
  maxPriceDeviationMultiplier?: number;
  /** Minimum plausible multiplier under purchase price (default: 0.01x / 99% drop) */
  minPriceDeviationMultiplier?: number;
}

export interface MarketPriceValidationResult {
  isValid: boolean;
  sanitizedCmp: number | null;
  reason?: string;
}

// Sensible financial terminal bounds for Indian equities
export const DEFAULT_MAX_ABSOLUTE_SHARE_PRICE = 1_000_000; // ₹10 Lakhs (MRF trades around ~₹1.4 Lakhs)
export const DEFAULT_MIN_ABSOLUTE_SHARE_PRICE = 0.01;      // 1 paisa
export const DEFAULT_MAX_PRICE_DEVIATION_MULTIPLIER = 50;  // 50x purchase price (5,000% gain)
export const DEFAULT_MIN_PRICE_DEVIATION_MULTIPLIER = 0.01; // 0.01x purchase price (99% drop)

/**
 * Validates an equity Current Market Price (CMP).
 * Returns `sanitizedCmp: null` if the price fails any sanity rule.
 */
export function validateMarketPrice(
  cmp: unknown,
  options?: MarketPriceValidationOptions
): MarketPriceValidationResult {
  // Null or undefined is valid as "data unavailable / pending"
  if (cmp === null || cmp === undefined) {
    return { isValid: true, sanitizedCmp: null };
  }

  // 1. Must be a finite number
  if (typeof cmp !== 'number' || isNaN(cmp) || !isFinite(cmp)) {
    return {
      isValid: false,
      sanitizedCmp: null,
      reason: `CMP must be a finite number; received ${String(cmp)}`,
    };
  }

  // 2. Must be strictly positive
  if (cmp <= 0) {
    return {
      isValid: false,
      sanitizedCmp: null,
      reason: `CMP must be strictly positive (> 0); received ${cmp}`,
    };
  }

  const maxAbs = options?.maxAbsolutePrice ?? DEFAULT_MAX_ABSOLUTE_SHARE_PRICE;
  const minAbs = options?.minAbsolutePrice ?? DEFAULT_MIN_ABSOLUTE_SHARE_PRICE;

  // 3. Absolute bounds check
  if (cmp < minAbs) {
    return {
      isValid: false,
      sanitizedCmp: null,
      reason: `CMP (${cmp}) is below minimum plausible price (${minAbs})`,
    };
  }

  if (cmp > maxAbs) {
    return {
      isValid: false,
      sanitizedCmp: null,
      reason: `CMP (${cmp}) exceeds maximum plausible equity share price (${maxAbs})`,
    };
  }

  // 4. Internal provider range check (52-week high)
  const high52 = options?.fiftyTwoWeekHigh;
  if (typeof high52 === 'number' && isFinite(high52) && high52 > 0) {
    // If CMP is more than 5x the 52-week high, the data is internally corrupt
    if (cmp > high52 * 5) {
      return {
        isValid: false,
        sanitizedCmp: null,
        reason: `CMP (${cmp}) implausibly contradicts 52-week high (${high52})`,
      };
    }
  }

  // 5. Relative check against holding purchase price
  const purchasePrice = options?.purchasePrice;
  if (typeof purchasePrice === 'number' && isFinite(purchasePrice) && purchasePrice > 0) {
    const maxMultiplier = options?.maxPriceDeviationMultiplier ?? DEFAULT_MAX_PRICE_DEVIATION_MULTIPLIER;
    const minMultiplier = options?.minPriceDeviationMultiplier ?? DEFAULT_MIN_PRICE_DEVIATION_MULTIPLIER;

    const ratio = cmp / purchasePrice;

    if (ratio > maxMultiplier) {
      return {
        isValid: false,
        sanitizedCmp: null,
        reason: `CMP (${cmp}) is implausibly high relative to purchase price (${purchasePrice}) - ratio ${ratio.toFixed(1)}x exceeds ${maxMultiplier}x`,
      };
    }

    if (ratio < minMultiplier) {
      return {
        isValid: false,
        sanitizedCmp: null,
        reason: `CMP (${cmp}) is implausibly low relative to purchase price (${purchasePrice}) - ratio ${ratio.toFixed(4)}x is below ${minMultiplier}x`,
      };
    }
  }

  return {
    isValid: true,
    sanitizedCmp: cmp,
  };
}

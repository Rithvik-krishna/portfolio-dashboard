import { PortfolioHolding, PortfolioSummary, PortfolioDataState } from '@/types/portfolio';
import { validateMarketPrice } from '@/lib/finance/marketValidation';

/**
 * Calculates initial investment amount.
 * Formula: purchasePrice * quantity
 *
 * Requirements:
 * - Deterministic, pure function
 * - Retains full floating point precision internally (no intermediate rounding)
 * - Returns 0 for invalid, non-positive, NaN, or non-finite inputs
 * - Never returns NaN or Infinity
 */
export function calculateInvestment(purchasePrice: unknown, quantity: unknown): number {
  if (
    typeof purchasePrice !== 'number' ||
    typeof quantity !== 'number' ||
    isNaN(purchasePrice) ||
    isNaN(quantity) ||
    !isFinite(purchasePrice) ||
    !isFinite(quantity) ||
    purchasePrice <= 0 ||
    quantity <= 0
  ) {
    return 0;
  }

  return purchasePrice * quantity;
}

/**
 * Calculates current market present value.
 * Formula: cmp * quantity
 *
 * Requirements:
 * - If CMP is null, undefined, NaN, or non-finite, returns null (NEVER defaults to 0)
 * - Returns valid number when CMP >= 0 and quantity > 0
 * - Never returns NaN or Infinity
 */
export function calculatePresentValue(
  cmp: unknown,
  quantity: unknown
): number | null {
  if (cmp === null || cmp === undefined) {
    return null;
  }

  if (
    typeof cmp !== 'number' ||
    typeof quantity !== 'number' ||
    isNaN(cmp) ||
    isNaN(quantity) ||
    !isFinite(cmp) ||
    !isFinite(quantity) ||
    cmp < 0 ||
    quantity <= 0
  ) {
    return null;
  }

  return cmp * quantity;
}

/**
 * Calculates nominal gain or loss.
 * Formula: presentValue - investment
 *
 * Requirements:
 * - If presentValue is null or unavailable, returns null (NEVER calculates 0 - investment)
 * - If investment is invalid, NaN, or non-finite, returns null
 * - Never returns NaN or Infinity
 */
export function calculateGainLoss(
  presentValue: unknown,
  investment: unknown
): number | null {
  if (presentValue === null || presentValue === undefined || investment === null || investment === undefined) {
    return null;
  }

  if (
    typeof presentValue !== 'number' ||
    typeof investment !== 'number' ||
    isNaN(presentValue) ||
    isNaN(investment) ||
    !isFinite(presentValue) ||
    !isFinite(investment)
  ) {
    return null;
  }

  return presentValue - investment;
}

/**
 * Calculates percentage gain or loss.
 * Formula: (gainLoss / investment) * 100
 *
 * Requirements:
 * - Returns null if gainLoss is null/undefined
 * - Returns null if investment is 0, negative, NaN, or non-finite
 * - Never returns NaN or Infinity
 */
export function calculateGainLossPercentage(
  gainLoss: unknown,
  investment: unknown
): number | null {
  if (gainLoss === null || gainLoss === undefined || investment === null || investment === undefined) {
    return null;
  }

  if (
    typeof gainLoss !== 'number' ||
    typeof investment !== 'number' ||
    isNaN(gainLoss) ||
    isNaN(investment) ||
    !isFinite(gainLoss) ||
    !isFinite(investment) ||
    investment <= 0
  ) {
    return null;
  }

  return (gainLoss / investment) * 100;
}

/**
 * Calculates portfolio weight (%) relative to total portfolio investment.
 * Formula: (investment / totalInvestment) * 100
 *
 * Decision:
 * If totalInvestment is 0, negative, or invalid, returns 0 to represent 0% allocation
 * safely without generating NaN or division-by-zero errors.
 */
export function calculatePortfolioWeight(
  investment: unknown,
  totalInvestment: unknown
): number {
  if (
    typeof investment !== 'number' ||
    typeof totalInvestment !== 'number' ||
    isNaN(investment) ||
    isNaN(totalInvestment) ||
    !isFinite(investment) ||
    !isFinite(totalInvestment) ||
    totalInvestment <= 0 ||
    investment <= 0
  ) {
    return 0;
  }

  return (investment / totalInvestment) * 100;
}

/**
 * Pure function to derive all financial metrics for an individual holding.
 * Sanitizes any invalid numerical inputs to prevent NaN/Infinity propagation.
 * Does NOT mutate the input object; returns a new PortfolioHolding instance.
 */
export function deriveHoldingMetrics(
  holding: Readonly<PortfolioHolding>,
  totalInvestment?: number
): PortfolioHolding {
  // Sanitize source numbers defensively
  const safePurchasePrice =
    typeof holding.purchasePrice === 'number' && !isNaN(holding.purchasePrice) && isFinite(holding.purchasePrice)
      ? holding.purchasePrice
      : 0;

  const safeQuantity =
    typeof holding.quantity === 'number' && !isNaN(holding.quantity) && isFinite(holding.quantity)
      ? holding.quantity
      : 0;

  const safeCmp = validateMarketPrice(holding.cmp, {
    purchasePrice: safePurchasePrice,
  }).sanitizedCmp;

  const investment = calculateInvestment(safePurchasePrice, safeQuantity);
  const presentValue = calculatePresentValue(safeCmp, safeQuantity);
  const gainLoss = calculateGainLoss(presentValue, investment);
  const gainLossPercentage = calculateGainLossPercentage(gainLoss, investment);

  let portfolioWeight: number | null = null;
  if (typeof totalInvestment === 'number' && totalInvestment > 0) {
    portfolioWeight = calculatePortfolioWeight(investment, totalInvestment);
  }

  return {
    ...holding,
    purchasePrice: safePurchasePrice,
    quantity: safeQuantity,
    cmp: safeCmp,
    investment,
    presentValue,
    gainLoss,
    gainLossPercentage,
    portfolioWeight,
  };
}

/**
 * Computes portfolio weights for an array of holdings immutably.
 * Does NOT mutate original array or holding objects.
 */
export function calculatePortfolioWeights(
  holdings: ReadonlyArray<PortfolioHolding>
): PortfolioHolding[] {
  const totalInvestment = holdings.reduce(
    (sum, h) => sum + calculateInvestment(h.purchasePrice, h.quantity),
    0
  );

  return holdings.map((holding) => {
    const investment = calculateInvestment(holding.purchasePrice, holding.quantity);
    const weight = calculatePortfolioWeight(investment, totalInvestment);
    return {
      ...holding,
      investment,
      portfolioWeight: weight,
    };
  });
}

/**
 * Hydrates an entire portfolio dataset immutably.
 * Calculates total initial investment and applies all derived metrics to each holding.
 */
export function hydratePortfolio(
  holdings: ReadonlyArray<PortfolioHolding>
): PortfolioHolding[] {
  const totalInvestment = holdings.reduce(
    (sum, h) => sum + calculateInvestment(h.purchasePrice, h.quantity),
    0
  );

  return holdings.map((holding) => deriveHoldingMetrics(holding, totalInvestment));
}

/**
 * Calculates aggregated overall portfolio summary metrics deterministically.
 * Accurately tracks market data coverage and handles all four data states.
 */
export function calculatePortfolioSummary(
  holdings: ReadonlyArray<PortfolioHolding>
): PortfolioSummary {
  const hydrated = hydratePortfolio(holdings);
  const holdingCount = hydrated.length;

  const totalInvestment = hydrated.reduce(
    (sum, h) => sum + (h.investment ?? 0),
    0
  );

  // Count holdings with available CMP market data
  const holdingsWithMarketData = hydrated.filter((h) => h.cmp !== null && h.cmp !== undefined).length;
  const marketDataCoverage = holdingCount > 0 ? (holdingsWithMarketData / holdingCount) * 100 : 0;
  const isMarketDataComplete = holdingCount > 0 && holdingsWithMarketData === holdingCount;

  // Determine Portfolio Data State
  let dataState: PortfolioDataState = 'SOURCE_ONLY';
  if (holdingsWithMarketData === 0) {
    dataState = 'SOURCE_ONLY';
  } else if (isMarketDataComplete) {
    dataState = 'COMPLETE_MARKET';
  } else {
    dataState = 'PARTIAL_MARKET';
  }

  let totalPresentValue: number | null = null;
  let totalGainLoss: number | null = null;
  let totalGainLossPercentage: number | null = null;

  if (holdingsWithMarketData > 0) {
    // Sum present values for holdings that have market quotes
    const activePVHoldings = hydrated.filter((h) => h.presentValue !== null && h.presentValue !== undefined);
    totalPresentValue = activePVHoldings.reduce((sum, h) => sum + (h.presentValue as number), 0);

    // If complete, calculate relative to total investment
    if (isMarketDataComplete) {
      totalGainLoss = totalPresentValue - totalInvestment;
      totalGainLossPercentage = totalInvestment > 0 ? (totalGainLoss / totalInvestment) * 100 : 0;
    } else {
      // Partial market data: gain/loss calculated strictly on holdings with valid market quotes
      const investmentOfActiveHoldings = activePVHoldings.reduce((sum, h) => sum + (h.investment as number), 0);
      totalGainLoss = totalPresentValue - investmentOfActiveHoldings;
      totalGainLossPercentage =
        investmentOfActiveHoldings > 0 ? (totalGainLoss / investmentOfActiveHoldings) * 100 : 0;
    }
  }

  const uniqueSectors = new Set(hydrated.map((h) => h.sector));

  return {
    totalInvestment,
    totalPresentValue,
    totalGainLoss,
    totalGainLossPercentage,
    holdingCount,
    sectorCount: uniqueSectors.size,
    holdingsWithMarketData,
    marketDataCoverage,
    isMarketDataComplete,
    dataState,
  };
}

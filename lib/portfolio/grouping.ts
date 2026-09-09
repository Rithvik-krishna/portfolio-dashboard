import { PortfolioHolding, SectorSummary } from '@/types/portfolio';
import { calculateInvestment, calculatePortfolioWeight } from './calculations';

/**
 * Groups holdings by sector immutably.
 * Returns a new dictionary mapping sector name to array of holdings.
 */
export function groupBySector(
  holdings: ReadonlyArray<PortfolioHolding>
): Record<string, PortfolioHolding[]> {
  return holdings.reduce((acc, holding) => {
    const sector = holding.sector || 'Unclassified';
    if (!acc[sector]) {
      acc[sector] = [];
    }
    acc[sector].push({ ...holding });
    return acc;
  }, {} as Record<string, PortfolioHolding[]>);
}

/**
 * Aggregates summary statistics for each sector immutably.
 * Reconciles sector totals with portfolio totals.
 * Handles missing or partial market data cleanly without forcing zeros.
 */
export function calculateSectorSummaries(
  holdings: ReadonlyArray<PortfolioHolding>
): SectorSummary[] {
  const grouped = groupBySector(holdings);

  // Grand total investment across the whole portfolio for sector weight derivation
  const grandTotalInvestment = holdings.reduce(
    (sum, h) => sum + calculateInvestment(h.purchasePrice, h.quantity),
    0
  );

  return Object.entries(grouped).map(([sector, sectorHoldings]) => {
    const sectorCount = sectorHoldings.length;

    // Sector investment sum (calculated directly to ensure 100% precision)
    const totalInvestment = sectorHoldings.reduce(
      (sum, h) => sum + calculateInvestment(h.purchasePrice, h.quantity),
      0
    );

    // Track sector market data availability
    const holdingsWithMarketData = sectorHoldings.filter(
      (h) => h.cmp !== null && h.cmp !== undefined
    ).length;

    const marketDataCoverage =
      sectorCount > 0 ? (holdingsWithMarketData / sectorCount) * 100 : 0;
    const isMarketDataComplete =
      sectorCount > 0 && holdingsWithMarketData === sectorCount;

    let totalPresentValue: number | null = null;
    let totalGainLoss: number | null = null;
    let totalGainLossPercentage: number | null = null;

    if (holdingsWithMarketData > 0) {
      const activeHoldings = sectorHoldings.filter(
        (h) => h.presentValue !== null && h.presentValue !== undefined
      );

      totalPresentValue = activeHoldings.reduce(
        (sum, h) => sum + (h.presentValue as number),
        0
      );

      if (isMarketDataComplete) {
        totalGainLoss = totalPresentValue - totalInvestment;
        totalGainLossPercentage =
          totalInvestment > 0 ? (totalGainLoss / totalInvestment) * 100 : 0;
      } else {
        const invOfActive = activeHoldings.reduce(
          (sum, h) => sum + calculateInvestment(h.purchasePrice, h.quantity),
          0
        );
        totalGainLoss = totalPresentValue - invOfActive;
        totalGainLossPercentage =
          invOfActive > 0 ? (totalGainLoss / invOfActive) * 100 : 0;
      }
    }

    const portfolioWeight = calculatePortfolioWeight(
      totalInvestment,
      grandTotalInvestment
    );

    return {
      sector,
      totalInvestment,
      totalPresentValue,
      totalGainLoss,
      totalGainLossPercentage,
      holdingsCount: sectorCount,
      portfolioWeight,
      holdingsWithMarketData,
      marketDataCoverage,
      isMarketDataComplete,
    };
  });
}

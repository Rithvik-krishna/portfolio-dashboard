'use client';

import React, { useMemo } from 'react';
import portfolioSource from '@/data/portfolio.json';
import { PortfolioHolding } from '@/types/portfolio';
import { hydratePortfolio, calculatePortfolioSummary } from '@/lib/portfolio/calculations';
import { calculateSectorSummaries } from '@/lib/portfolio/grouping';
import { useMarketData } from '@/hooks/useMarketData';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary';
import { PortfolioAllocation } from '@/components/charts/PortfolioAllocation';
import { SectorPerformance } from '@/components/charts/SectorPerformance';
import { PortfolioTable } from '@/components/dashboard/PortfolioTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { validateMarketPrice } from '@/lib/finance/marketValidation';

export default function DashboardPage() {
  const {
    marketDataMap,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    coverage,
    totalHoldings,
    resolvedHoldings,
    isStale,
    refresh,
  } = useMarketData();

  // Pure deterministic derivation: Source Holdings + Real-Time Market Data -> Hydrated Portfolio
  const { hydratedHoldings, summary, sectorSummaries } = useMemo(() => {
    const rawHoldings = portfolioSource as PortfolioHolding[];

    // Immutably merge market quotes into source holdings
    const merged = rawHoldings.map((h) => {
      const liveQuote =
        marketDataMap.get(h.exchangeCode.toUpperCase()) ||
        marketDataMap.get(h.name.toUpperCase());

      const validatedCmp = validateMarketPrice(liveQuote?.cmp, {
        purchasePrice: h.purchasePrice,
      }).sanitizedCmp;

      return {
        ...h,
        cmp: validatedCmp,
        peRatio: liveQuote?.peRatio !== undefined ? liveQuote.peRatio : null,
        latestEarnings: liveQuote?.latestEarnings !== undefined ? liveQuote.latestEarnings : null,
      };
    });

    // Derive financial calculations using the single source of truth calculation engine
    const hydrated = hydratePortfolio(merged);
    const sum = calculatePortfolioSummary(hydrated);
    const sectors = calculateSectorSummaries(hydrated);

    return {
      hydratedHoldings: hydrated,
      summary: sum,
      sectorSummaries: sectors,
    };
  }, [marketDataMap]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header with Title and Real-Time Market Status */}
        <DashboardHeader
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          isStale={isStale}
          error={error}
          lastUpdated={lastUpdated}
          coverage={coverage}
          resolvedHoldings={resolvedHoldings}
          totalHoldings={totalHoldings}
          onRefresh={refresh}
        />

        {/* Transient Network/Provider Error Banner (Preserves previous data) */}
        {error && (
          <ErrorState
            title="Market Data Refresh Notice"
            message={`${error}. Preserving last available portfolio market values.`}
            onRetry={refresh}
            isRetrying={isRefreshing}
          />
        )}

        {/* KPI Summary Cards */}
        <PortfolioSummary
          summary={summary}
          isLoading={isLoading && marketDataMap.size === 0}
          lastUpdated={lastUpdated}
        />

        {/* Visualization Grid: Sector Allocation (Donut) & Sector Performance (Bar) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PortfolioAllocation
            sectors={sectorSummaries}
            isLoading={isLoading && marketDataMap.size === 0}
          />
          <SectorPerformance
            sectors={sectorSummaries}
            isLoading={isLoading && marketDataMap.size === 0}
          />
        </section>

        {/* Portfolio Holdings Tabular Grid (Collapsible Sectors) */}
        <section className="space-y-3">
          <PortfolioTable
            holdings={hydratedHoldings}
            sectorSummaries={sectorSummaries}
            isLoading={isLoading && marketDataMap.size === 0}
          />
        </section>

        {/* Minimal Financial Footer */}
        <footer className="pt-4 border-t border-slate-900 text-center text-xs text-slate-400">
          <p>
            Dynamic Portfolio Dashboard • Institutional financial calculations powered by pure calculation engine
          </p>
        </footer>
      </main>
    </div>
  );
}

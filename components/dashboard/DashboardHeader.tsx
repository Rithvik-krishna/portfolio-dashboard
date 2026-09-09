import React from 'react';
import { MarketStatus } from './MarketStatus';

interface DashboardHeaderProps {
  isLoading: boolean;
  isRefreshing: boolean;
  isStale: boolean;
  error: string | null;
  lastUpdated: string | null;
  coverage: number;
  resolvedHoldings: number;
  totalHoldings: number;
  onRefresh?: () => void;
}

export function DashboardHeader({
  isLoading,
  isRefreshing,
  isStale,
  error,
  lastUpdated,
  coverage,
  resolvedHoldings,
  totalHoldings,
  onRefresh,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-1.5 rounded-full bg-indigo-500" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Portfolio Intelligence
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 pl-4">
          Live portfolio monitoring and performance
        </p>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 pl-4 sm:pl-0">
        <MarketStatus
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          isStale={isStale}
          error={error}
          lastUpdated={lastUpdated}
          coverage={coverage}
          resolvedHoldings={resolvedHoldings}
          totalHoldings={totalHoldings}
          onRefresh={onRefresh}
        />
      </div>
    </header>
  );
}

import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Landmark, Percent } from 'lucide-react';
import { PortfolioSummary as IPortfolioSummary } from '@/types/portfolio';
import { formatCurrency, formatPercentage, formatRelativeTime } from '@/lib/formatters';
import { SummaryCardSkeleton } from '@/components/ui/Skeleton';

interface PortfolioSummaryProps {
  summary: IPortfolioSummary;
  isLoading?: boolean;
  lastUpdated?: string | null;
}

export function PortfolioSummary({
  summary,
  isLoading = false,
  lastUpdated,
}: PortfolioSummaryProps) {
  if (isLoading) {
    return (
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </section>
    );
  }

  const isGainPositive = summary.totalGainLoss !== null && summary.totalGainLoss > 0;
  const isGainNegative = summary.totalGainLoss !== null && summary.totalGainLoss < 0;

  const gainColorClass = isGainPositive
    ? 'text-emerald-400'
    : isGainNegative
    ? 'text-rose-400'
    : 'text-slate-400';

  const gainBgClass = isGainPositive
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : isGainNegative
    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    : 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Investment */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Investment
          </span>
          <div className="rounded-lg p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {formatCurrency(summary.totalInvestment)}
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
          <span>{summary.holdingCount} holdings across 6 sectors</span>
        </div>
      </div>

      {/* 2. Current Portfolio Value */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Current Value
          </span>
          <div className="rounded-lg p-2 bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Landmark className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {summary.totalPresentValue !== null ? formatCurrency(summary.totalPresentValue) : 'N/A'}
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
          {summary.totalPresentValue !== null ? (
            <span>Updated {formatRelativeTime(lastUpdated)}</span>
          ) : (
            <span className="text-amber-400/90">Awaiting market feed</span>
          )}
        </div>
      </div>

      {/* 3. Total Gain / Loss */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Gain / Loss
          </span>
          <div className={`rounded-lg p-2 border ${gainBgClass}`}>
            {isGainPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : isGainNegative ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Percent className="h-4 w-4" />
            )}
          </div>
        </div>
        <div className="mt-2">
          <div className={`text-2xl font-bold tracking-tight font-mono ${gainColorClass}`}>
            {summary.totalGainLoss !== null
              ? formatCurrency(summary.totalGainLoss, { includeSign: true })
              : 'N/A'}
          </div>
        </div>
        <div className="mt-2 text-xs flex items-center gap-1.5">
          {summary.totalGainLossPercentage !== null ? (
            <span className={`font-medium ${gainColorClass}`}>
              {formatPercentage(summary.totalGainLossPercentage)}
            </span>
          ) : (
            <span className="text-slate-500">Unrealized P&L</span>
          )}
        </div>
      </div>

      {/* 4. Overall Return */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Overall Return
          </span>
          <div className="rounded-lg p-2 bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Percent className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className={`text-2xl font-bold tracking-tight font-mono ${gainColorClass}`}>
            {summary.totalGainLossPercentage !== null
              ? formatPercentage(summary.totalGainLossPercentage)
              : 'N/A'}
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
          <span>Weighted return since purchase</span>
        </div>
      </div>
    </section>
  );
}

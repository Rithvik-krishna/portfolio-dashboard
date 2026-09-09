import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';

interface MarketStatusProps {
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

export function MarketStatus({
  isLoading,
  isRefreshing,
  isStale,
  error,
  lastUpdated,
  coverage,
  resolvedHoldings,
  totalHoldings,
  onRefresh,
}: MarketStatusProps) {
  // Local ticker to re-evaluate relative time every 5 seconds
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const relativeTime = formatRelativeTime(lastUpdated);

  // Determine status display state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 text-xs font-medium">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-400" />
        <span>CONNECTING FEED...</span>
      </div>
    );
  }

  if (isRefreshing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-300 text-xs font-medium">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-400" />
        <span>UPDATING FEED...</span>
      </div>
    );
  }

  if (error && resolvedHoldings === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs font-medium">
        <XCircle className="h-3.5 w-3.5 text-rose-400" />
        <span>FEED UNAVAILABLE</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="ml-1 hover:text-white transition-colors"
            title="Retry connecting to feed"
            aria-label="Retry connecting to feed"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  if (isStale || error) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs font-medium">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5">
            <span className="font-semibold">STALE DATA</span>
            <span className="text-amber-400/80 text-[11px]">({relativeTime})</span>
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
            title="Refresh now"
            aria-label="Refresh market data now"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Active / Live state
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs font-medium">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide text-emerald-400">LIVE</span>
          <span className="text-slate-400 text-[11px]">•</span>
          <span className="text-slate-400 text-[11px]">{relativeTime}</span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-800 bg-slate-900/60 text-slate-400 text-[11px]">
        <CheckCircle2 className="h-3 w-3 text-slate-500" />
        <span>{coverage}% coverage ({resolvedHoldings}/{totalHoldings})</span>
      </div>

      {onRefresh && (
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          title="Manual refresh"
          aria-label="Refresh market data"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

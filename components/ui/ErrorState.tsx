import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ErrorState({
  title = 'Failed to Load Market Data',
  message = 'We could not reach the market data feed. Showing last known available data.',
  onRetry,
  isRetrying = false,
}: ErrorStateProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
        <div>
          <h4 className="text-sm font-semibold text-rose-200">{title}</h4>
          <p className="text-xs text-rose-300/80 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Retry'}
        </button>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StockMarketData, MarketDataApiResponse } from '@/types/market';

export interface UseMarketDataResult {
  marketDataMap: Map<string, StockMarketData>;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: string | null;
  coverage: number;
  totalHoldings: number;
  resolvedHoldings: number;
  isStale: boolean;
  refresh: () => Promise<void>;
}

const REFRESH_INTERVAL_MS = 15000; // 15 seconds

export function useMarketData(): UseMarketDataResult {
  const [marketDataMap, setMarketDataMap] = useState<Map<string, StockMarketData>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<number>(0);
  const [totalHoldings, setTotalHoldings] = useState<number>(26);
  const [resolvedHoldings, setResolvedHoldings] = useState<number>(0);
  const [isStale, setIsStale] = useState<boolean>(false);

  // In-flight guard to prevent overlapping queries
  const isFetchingRef = useRef<boolean>(false);
  const hasMountedRef = useRef<boolean>(false);

  const fetchMarketData = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) {
      return; // Deduplicate in-flight polling
    }

    isFetchingRef.current = true;
    await Promise.resolve(); // yield to microtask to ensure asynchronous execution

    if (!isInitial) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch('/api/market-data', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch market data`);
      }

      const json: MarketDataApiResponse = await response.json();

      if (json.success && Array.isArray(json.data)) {
        const nextMap = new Map<string, StockMarketData>();
        let resolvedCount = 0;

        for (const item of json.data) {
          nextMap.set(item.exchangeCode.toUpperCase(), item);
          nextMap.set(item.symbol.toUpperCase(), item);
          if (item.cmp !== null) {
            resolvedCount++;
          }
        }

        setMarketDataMap(nextMap);
        setLastUpdated(json.requestTimestamp || new Date().toISOString());
        setResolvedHoldings(resolvedCount);
        setTotalHoldings(json.data.length || 26);
        setCoverage(
          typeof json.coverage === 'number'
            ? json.coverage
            : json.data.length > 0
            ? Math.round((resolvedCount / json.data.length) * 100)
            : 0
        );
        setIsStale(Boolean(json.isStale));
        setError(null);
      } else {
        throw new Error('Invalid response structure from market data API');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Market data refresh failed';
      setError(msg);
      // NOTE: We do NOT clear marketDataMap on refresh failure — previous successful data is preserved
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    hasMountedRef.current = true;

    const initialTimer = setTimeout(() => {
      void fetchMarketData(true);
    }, 0);

    const intervalId = setInterval(() => {
      if (hasMountedRef.current) {
        void fetchMarketData(false);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      hasMountedRef.current = false;
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, [fetchMarketData]);

  const handleManualRefresh = useCallback(async () => {
    await fetchMarketData(false);
  }, [fetchMarketData]);

  return {
    marketDataMap,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    coverage,
    totalHoldings,
    resolvedHoldings,
    isStale,
    refresh: handleManualRefresh,
  };
}

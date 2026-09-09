import { NextRequest, NextResponse } from 'next/server';
import { marketDataService } from '@/lib/finance/marketData';
import portfolioData from '@/data/portfolio.json';
import { PortfolioHolding } from '@/types/portfolio';
import { MarketDataApiResponse } from '@/types/market';
import { financeLogger } from '@/lib/finance/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/market-data
 *
 * Retrieves market data for the portfolio.
 * Utilizes server-side in-memory caching and request deduplication.
 * Supports optional ?symbols= query parameter for targeted filtering.
 */
export async function GET(request: NextRequest): Promise<NextResponse<MarketDataApiResponse>> {
  const requestTimestamp = new Date().toISOString();

  try {
    const { searchParams } = new URL(request.url);
    const symbolsFilter = searchParams.get('symbols');

    const holdings = portfolioData as PortfolioHolding[];

    let targetHoldings = holdings.map((h) => ({
      name: h.name,
      exchangeCode: h.exchangeCode,
    }));

    if (symbolsFilter !== null) {
      const rawTokens = symbolsFilter
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0);

      // Deduplicate and cap maximum symbol count to protect against uncontrolled queries
      const requestedList = Array.from(new Set(rawTokens)).slice(0, 50);

      if (requestedList.length > 0) {
        targetHoldings = targetHoldings.filter((h) =>
          requestedList.includes(h.exchangeCode.toUpperCase()) ||
          requestedList.includes(h.name.toUpperCase())
        );
      } else {
        // Empty symbol list requested explicitly -> return empty result safely
        targetHoldings = [];
      }
    }

    financeLogger.info('API:MarketData', `Processing request for ${targetHoldings.length} holdings`);

    if (targetHoldings.length === 0) {
      return NextResponse.json({
        success: true,
        requestTimestamp,
        data: [],
        errors: [],
        coverage: 0,
      });
    }

    const result = await marketDataService.getPortfolioMarketData(targetHoldings);

    return NextResponse.json({
      success: true,
      requestTimestamp,
      data: result.data,
      errors: result.errors,
      coverage: result.coverage,
      isStale: result.isStale,
    });
  } catch (err: unknown) {
    financeLogger.error('API:MarketData', 'Unhandled exception in market-data route', err);

    return NextResponse.json(
      {
        success: false,
        requestTimestamp,
        data: [],
        errors: [
          {
            code: 'UNKNOWN_ERROR',
            message: err instanceof Error ? err.message : 'Internal server error retrieving market data',
            provider: 'SYSTEM',
            timestamp: requestTimestamp,
          },
        ],
        coverage: 0,
      },
      { status: 500 }
    );
  }
}

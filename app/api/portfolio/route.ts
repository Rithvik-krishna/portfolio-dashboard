import { NextResponse } from 'next/server';
import portfolioData from '@/data/portfolio.json';
import { PortfolioHolding } from '@/types/portfolio';
import { hydratePortfolio, calculatePortfolioSummary } from '@/lib/portfolio/calculations';
import { calculateSectorSummaries } from '@/lib/portfolio/grouping';
import { validatePortfolio } from '@/lib/portfolio/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portfolio
 *
 * Exposes the normalized portfolio holdings along with baseline calculations
 * and sector summaries derived by the calculation engine.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const rawHoldings = portfolioData as PortfolioHolding[];
    const validation = validatePortfolio(rawHoldings);
    const hydrated = hydratePortfolio(rawHoldings);
    const summary = calculatePortfolioSummary(hydrated);
    const sectorSummaries = calculateSectorSummaries(hydrated);

    return NextResponse.json({
      success: true,
      timestamp,
      count: hydrated.length,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
      },
      summary,
      sectorSummaries,
      data: hydrated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        timestamp,
        error: err instanceof Error ? err.message : 'Failed to retrieve portfolio data',
      },
      { status: 500 }
    );
  }
}

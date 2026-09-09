import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatCompactNumber,
  formatRelativeTime,
} from '../lib/formatters';
import { hydratePortfolio, calculatePortfolioSummary } from '../lib/portfolio/calculations';
import { calculateSectorSummaries } from '../lib/portfolio/grouping';
import { PortfolioHolding } from '../types/portfolio';
import { StockMarketData } from '../types/market';

console.log('====================================================');
console.log('PHASE 6: PRODUCTION UI, FORMATTERS & REFRESH TEST SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// SECTION 1: FORMATTER UTILITIES & NULL/NA SAFETY (Items 6, 9, 10, 11)
// ----------------------------------------------------
console.log('--- 1. Financial Formatters & Null Safety ---');

// 1.1 Currency formatting
assert.strictEqual(formatCurrency(1543060), '₹15,43,060', '1.1 formatCurrency standard Indian format');
assert.strictEqual(formatCurrency(1543060.45, { showDecimals: true }), '₹15,43,060.45', '1.2 formatCurrency with decimals');
assert.strictEqual(formatCurrency(48349, { includeSign: true }), '+₹48,349', '1.3 formatCurrency positive sign');
assert.strictEqual(formatCurrency(-4200, { includeSign: true }), '-₹4,200', '1.4 formatCurrency negative sign');
assert.strictEqual(formatCurrency(null), 'N/A', '1.5 formatCurrency returns N/A for null');
assert.strictEqual(formatCurrency(undefined), 'N/A', '1.6 formatCurrency returns N/A for undefined');
assert.strictEqual(formatCurrency(NaN), 'N/A', '1.7 formatCurrency returns N/A for NaN');
assert.strictEqual(formatCurrency(Infinity), 'N/A', '1.8 formatCurrency returns N/A for Infinity');
console.log('✓ [PASS] 1.1 - 1.8 Currency formatting & null safety verified');

// 1.2 Percentage formatting
assert.strictEqual(formatPercentage(3.13), '+3.13%', '1.9 formatPercentage positive with sign');
assert.strictEqual(formatPercentage(-5.13), '-5.13%', '1.10 formatPercentage negative with sign');
assert.strictEqual(formatPercentage(0), '0.00%', '1.11 formatPercentage zero');
assert.strictEqual(formatPercentage(21.294, { includeSign: false }), '21.29%', '1.12 formatPercentage without sign');
assert.strictEqual(formatPercentage(null), 'N/A', '1.13 formatPercentage null safety');
assert.strictEqual(formatPercentage(undefined), 'N/A', '1.14 formatPercentage undefined safety');
console.log('✓ [PASS] 1.9 - 1.14 Percentage formatting & sign display verified');

// 1.3 Number & Compact formatting
assert.strictEqual(formatNumber(79.84, 2), '79.84', '1.15 formatNumber P/E format');
assert.strictEqual(formatNumber(null), 'N/A', '1.16 formatNumber null safety');
assert.strictEqual(formatCompactNumber(1543060), '₹15.43 L', '1.17 formatCompactNumber Lakhs');
assert.strictEqual(formatCompactNumber(25000000), '₹2.50 Cr', '1.18 formatCompactNumber Crores');
assert.strictEqual(formatCompactNumber(null), 'N/A', '1.19 formatCompactNumber null safety');
console.log('✓ [PASS] 1.15 - 1.19 Number & compact formatting verified');

// 1.4 Relative Time formatting
assert.strictEqual(formatRelativeTime(null), 'Never', '1.20 formatRelativeTime null');
const now = new Date().toISOString();
assert.strictEqual(formatRelativeTime(now), 'just now', '1.21 formatRelativeTime current');
const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
assert.strictEqual(formatRelativeTime(tenSecondsAgo), '10s ago', '1.22 formatRelativeTime seconds ago');
console.log('✓ [PASS] 1.20 - 1.22 Relative time formatting verified');

// ----------------------------------------------------
// SECTION 2: PRODUCTION DATASET INTEGRATION & RECONCILIATION (Items 13, 14)
// ----------------------------------------------------
console.log('\n--- 2. Dataset Hydration & Reconciliation ---');
const portfolioPath = path.resolve(process.cwd(), 'data/portfolio.json');
const rawHoldings: PortfolioHolding[] = JSON.parse(fs.readFileSync(portfolioPath, 'utf-8'));

assert.strictEqual(rawHoldings.length, 26, '2.1 Exactly 26 active holdings loaded');

// Simulate real market data feed merge
const mockMarketQuotes: Record<string, StockMarketData> = {
  HDFCBANK: {
    symbol: 'HDFC Bank',
    exchangeCode: 'HDFCBANK',
    cmp: 1650,
    peRatio: 18.5,
    latestEarnings: 45.2,
    timestamp: now,
    cachedAt: now,
    quoteSource: 'YAHOO',
    valuationSource: 'GOOGLE',
  },
  BAJFINANCE: {
    symbol: 'Bajaj Finance',
    exchangeCode: 'BAJFINANCE',
    cmp: 6800,
    peRatio: 31.2,
    latestEarnings: 110.4,
    timestamp: now,
    cachedAt: now,
    quoteSource: 'YAHOO',
    valuationSource: 'GOOGLE',
  },
  DMART: {
    symbol: 'Dmart',
    exchangeCode: 'DMART',
    cmp: 3750,
    peRatio: 79.84,
    latestEarnings: null, // Legitimate null as observed in live tests
    timestamp: now,
    cachedAt: now,
    quoteSource: 'YAHOO',
    valuationSource: 'GOOGLE',
  },
};

// Merge market quotes into raw holdings
const mergedHoldings: PortfolioHolding[] = rawHoldings.map((h) => {
  const quote = mockMarketQuotes[h.exchangeCode.toUpperCase()];
  return {
    ...h,
    cmp: quote?.cmp ?? null,
    peRatio: quote?.peRatio ?? null,
    latestEarnings: quote?.latestEarnings ?? null,
  };
});

const hydrated = hydratePortfolio(mergedHoldings);
const summary = calculatePortfolioSummary(hydrated);
const sectors = calculateSectorSummaries(hydrated);

// 2.1 Baseline investment benchmark check
assert.strictEqual(summary.totalInvestment, 1543060, '2.2 Total investment benchmark exact match ₹15,43,060');

// 2.2 Reconcile sector totals with portfolio total
const sectorInvestmentSum = sectors.reduce((acc, s) => acc + s.totalInvestment, 0);
assert.strictEqual(sectorInvestmentSum, summary.totalInvestment, '2.3 Sum of sector investments matches portfolio total investment');

const sectorWeightSum = sectors.reduce((acc, s) => acc + s.portfolioWeight, 0);
assert(Math.abs(sectorWeightSum - 100) < 0.001, '2.4 Sum of sector weights reconciles to 100%');

const sectorHoldingsSum = sectors.reduce((acc, s) => acc + s.holdingsCount, 0);
assert.strictEqual(sectorHoldingsSum, 26, '2.5 Total sector holdings count matches exactly 26');
console.log('✓ [PASS] 2.1 - 2.5 Dataset hydration and sector reconciliation verified');

// ----------------------------------------------------
// SECTION 3: PARTIAL & ERROR RESILIENCE (Items 3, 4, 6, 8)
// ----------------------------------------------------
console.log('\n--- 3. Partial Market Data & Fallback States ---');

// 3.1 Unhydrated / Null Market Feed State
const emptyHydrated = hydratePortfolio(rawHoldings);
const emptySummary = calculatePortfolioSummary(emptyHydrated);
assert.strictEqual(emptySummary.totalInvestment, 1543060, '3.1 Source investment remains ₹15,43,060 without market data');
assert.strictEqual(emptySummary.totalPresentValue, null, '3.2 Present value is null (NOT 0) when market feed empty');
assert.strictEqual(emptySummary.totalGainLoss, null, '3.3 Gain/loss is null (NOT 0) when market feed empty');
assert.strictEqual(emptySummary.marketDataCoverage, 0, '3.4 Coverage is 0% when market feed empty');

// Formatter output check for empty state
assert.strictEqual(formatCurrency(emptySummary.totalPresentValue), 'N/A', '3.5 formatCurrency displays N/A for empty present value');
assert.strictEqual(formatCurrency(emptySummary.totalGainLoss), 'N/A', '3.6 formatCurrency displays N/A for empty gain/loss');

// 3.2 Partial Market Data State (3 out of 26 holdings have quotes)
assert.strictEqual(summary.holdingsWithMarketData, 3, '3.7 Exactly 3 holdings resolved in partial test');
assert(summary.marketDataCoverage > 0 && summary.marketDataCoverage < 100, '3.8 Partial coverage accurately reflected');
assert(summary.totalPresentValue !== null && summary.totalPresentValue > 0, '3.9 Present value populated for active holdings');
assert(summary.totalGainLoss !== null, '3.10 Gain/loss calculated on resolved holdings');
console.log('✓ [PASS] 3.1 - 3.10 Partial market data & fallback states verified');

// ----------------------------------------------------
// SECTION 4: REQUIRED 11 COLUMNS CONTRACT VERIFICATION (Item 7)
// ----------------------------------------------------
console.log('\n--- 4. Holdings Table 11-Column Contract ---');
const sampleHolding = hydrated[0];
const requiredColumns = [
  'name',            // 1. Particulars / Stock Name
  'purchasePrice',   // 2. Purchase Price
  'quantity',        // 3. Quantity
  'investment',      // 4. Investment
  'portfolioWeight', // 5. Portfolio %
  'exchangeCode',    // 6. NSE/BSE Exchange
  'cmp',             // 7. Current Market Price
  'presentValue',    // 8. Present Value
  'gainLoss',        // 9. Gain / Loss
  'peRatio',         // 10. P/E Ratio
  'latestEarnings',  // 11. Latest Earnings
];

for (const col of requiredColumns) {
  assert(col in sampleHolding, `4. Column '${col}' exists in hydrated holding model`);
}
console.log('✓ [PASS] All 11 required columns validated on portfolio model');

// ----------------------------------------------------
// SECTION 5: CLEAN USER-FACING PRODUCTION UI SANITY (Items 1, 34)
// ----------------------------------------------------
console.log('\n--- 5. User-Facing Production UI Sanity ---');
const pageFile = fs.readFileSync(path.resolve(process.cwd(), 'app/page.tsx'), 'utf-8');

const forbiddenDevPhrases = [
  'Phase 2',
  'Phase 3',
  'Phase 4',
  'Phase 5',
  '83/83 Tests Passed',
  'Tests Passed',
  'assertion count',
  'lib/portfolio/calculations.ts',
  'fake CMP',
  'SOURCE_ONLY',
  'COMPLETE_MARKET',
  'developer walkthrough',
  'Awaiting Feed',
];

for (const phrase of forbiddenDevPhrases) {
  assert(
    !pageFile.includes(phrase),
    `5. Development phrase '${phrase}' cleanly removed from production app/page.tsx`
  );
}

// Ensure professional title and subtitle are present in Header component
const headerFile = fs.readFileSync(path.resolve(process.cwd(), 'components/dashboard/DashboardHeader.tsx'), 'utf-8');
assert(headerFile.includes('Portfolio Intelligence'), '5.1 Title "Portfolio Intelligence" present in DashboardHeader');
assert(headerFile.includes('Live portfolio monitoring and performance'), '5.2 Subtitle present in DashboardHeader');
assert(pageFile.includes('DashboardHeader'), '5.3 DashboardHeader component utilized');
assert(pageFile.includes('PortfolioSummary'), '5.4 PortfolioSummary component utilized');
assert(pageFile.includes('PortfolioAllocation'), '5.5 PortfolioAllocation chart utilized');
assert(pageFile.includes('SectorPerformance'), '5.6 SectorPerformance chart utilized');
assert(pageFile.includes('PortfolioTable'), '5.7 PortfolioTable component utilized');
console.log('✓ [PASS] Production dashboard cleanliness verified (no dev artifacts)');

console.log('\n----------------------------------------------------');
console.log('Phase 6 Test Results: All assertions passed successfully.');
console.log('----------------------------------------------------');

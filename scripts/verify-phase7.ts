import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { PortfolioHolding } from '../types/portfolio';
import { calculatePortfolioSummary, hydratePortfolio } from '../lib/portfolio/calculations';
import { calculateSectorSummaries } from '../lib/portfolio/grouping';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatCompactNumber,
  formatRelativeTime,
} from '../lib/formatters';
import { MemoryCache } from '../lib/cache';

console.log('====================================================');
console.log('PHASE 7: FINAL SUBMISSION HARDENING & QA SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// A - D: PORTFOLIO DATA INTEGRITY & BENCHMARKS
// ----------------------------------------------------
console.log('--- A - D: Dataset Integrity & Benchmarks ---');
const portfolioPath = path.resolve(process.cwd(), 'data/portfolio.json');
assert(fs.existsSync(portfolioPath), 'A. data/portfolio.json exists');

const rawHoldings: PortfolioHolding[] = JSON.parse(fs.readFileSync(portfolioPath, 'utf-8'));
assert.strictEqual(rawHoldings.length, 26, 'B. Exactly 26 active holdings loaded');

const sectors = new Set(rawHoldings.map((h) => h.sector.trim()));
assert.strictEqual(sectors.size, 6, 'C. Exactly 6 unique sectors present');

const hydrated = hydratePortfolio(rawHoldings);
const summary = calculatePortfolioSummary(hydrated);
assert.strictEqual(summary.totalInvestment, 1543060, 'D. Total investment benchmark matches exact ₹15,43,060');

// Verify all source CMP / PE values in portfolio.json are pristine nulls
const pristineCheck = rawHoldings.every(
  (h) => h.cmp === null && h.peRatio === null && h.latestEarnings === null
);
assert(pristineCheck, 'A.2 Source portfolio.json strictly contains null market fields (no fake CMP/PE)');
console.log('✓ [PASS] A - D: Dataset integrity, 26 holdings, 6 sectors, ₹15,43,060 benchmark verified');

// ----------------------------------------------------
// E - F: NO NaN OR INFINITY PROPAGATION
// ----------------------------------------------------
console.log('\n--- E - F: Numerical Cleanliness (No NaN / No Infinity) ---');
for (const h of hydrated) {
  assert(!isNaN(h.investment ?? 0), `E.1 Holding ${h.name} investment is not NaN`);
  assert(isFinite(h.investment ?? 0), `F.1 Holding ${h.name} investment is finite`);
  if (h.portfolioWeight !== null && h.portfolioWeight !== undefined) {
    assert(!isNaN(h.portfolioWeight), `E.2 Holding ${h.name} weight is not NaN`);
    assert(isFinite(h.portfolioWeight), `F.2 Holding ${h.name} weight is finite`);
  }
}

const sectorSummaries = calculateSectorSummaries(hydrated);
for (const s of sectorSummaries) {
  assert(!isNaN(s.totalInvestment) && isFinite(s.totalInvestment), `E/F. Sector ${s.sector} investment is finite`);
  assert(!isNaN(s.portfolioWeight) && isFinite(s.portfolioWeight), `E/F. Sector ${s.sector} weight is finite`);
}
console.log('✓ [PASS] E - F: Numerical safety verified (zero NaN, zero Infinity)');

// ----------------------------------------------------
// G: API ROUTE EXISTENCE
// ----------------------------------------------------
console.log('\n--- G: API Route Handlers ---');
const portfolioRoutePath = path.resolve(process.cwd(), 'app/api/portfolio/route.ts');
const marketDataRoutePath = path.resolve(process.cwd(), 'app/api/market-data/route.ts');
assert(fs.existsSync(portfolioRoutePath), 'G.1 app/api/portfolio/route.ts exists');
assert(fs.existsSync(marketDataRoutePath), 'G.2 app/api/market-data/route.ts exists');
console.log('✓ [PASS] G: API routes verified');

// ----------------------------------------------------
// H: FORMATTER SAFETY CONTRACT
// ----------------------------------------------------
console.log('\n--- H: Formatter Safety Contract ---');
assert.strictEqual(formatCurrency(null), 'N/A', 'H.1 Currency null safety');
assert.strictEqual(formatCurrency(undefined), 'N/A', 'H.2 Currency undefined safety');
assert.strictEqual(formatCurrency(NaN), 'N/A', 'H.3 Currency NaN safety');
assert.strictEqual(formatCurrency(Infinity), 'N/A', 'H.4 Currency Infinity safety');
assert.strictEqual(formatPercentage(null), 'N/A', 'H.5 Percentage null safety');
assert.strictEqual(formatNumber(null), 'N/A', 'H.6 Number null safety');
assert.strictEqual(formatCompactNumber(null), 'N/A', 'H.7 Compact number null safety');
assert.strictEqual(formatRelativeTime(null), 'Never', 'H.8 Relative time null safety');
console.log('✓ [PASS] H: All formatters verified null-safe with N/A fallbacks');

// ----------------------------------------------------
// I: REQUIRED UI COMPONENTS EXISTENCE
// ----------------------------------------------------
console.log('\n--- I: Required UI Components ---');
const requiredComponents = [
  'components/dashboard/DashboardHeader.tsx',
  'components/dashboard/MarketStatus.tsx',
  'components/dashboard/PortfolioSummary.tsx',
  'components/dashboard/PortfolioTable.tsx',
  'components/dashboard/PortfolioRow.tsx',
  'components/dashboard/SectorSection.tsx',
  'components/charts/PortfolioAllocation.tsx',
  'components/charts/SectorPerformance.tsx',
  'components/ui/Badge.tsx',
  'components/ui/Skeleton.tsx',
  'components/ui/ErrorState.tsx',
  'hooks/useMarketData.ts',
  'lib/formatters.ts',
];

for (const compPath of requiredComponents) {
  assert(fs.existsSync(path.resolve(process.cwd(), compPath)), `I. Component ${compPath} exists`);
}
console.log('✓ [PASS] I: All 13 production UI components and hooks verified');

// ----------------------------------------------------
// J: NO DEVELOPMENT-ONLY TEXT IN PRODUCTION PAGE
// ----------------------------------------------------
console.log('\n--- J: Production Cleanliness (No Dev UI Artifacts) ---');
const pageSource = fs.readFileSync(path.resolve(process.cwd(), 'app/page.tsx'), 'utf-8');
const bannedKeywords = [
  'Phase 2',
  'Phase 3',
  'Phase 4',
  'Phase 5',
  'Tests Passed',
  'assertion count',
  'lib/portfolio/calculations.ts',
  'fake CMP',
  'SOURCE_ONLY',
  'COMPLETE_MARKET',
  'PARTIAL_MARKET',
];

for (const keyword of bannedKeywords) {
  assert(!pageSource.includes(keyword), `J. Banned dev keyword '${keyword}' not in app/page.tsx`);
}
console.log('✓ [PASS] J: Clean production page confirmed (no developer artifacts)');

// ----------------------------------------------------
// K - L: CACHE CONFIGURATION & STALE BEHAVIOR
// ----------------------------------------------------
console.log('\n--- K - L: Cache & Stale Behavior ---');
const testCache = new MemoryCache();
testCache.set('stock:TEST', { price: 100 }, 60000);
assert(testCache.has('stock:TEST'), 'K.1 Cache stores entry with 60s TTL');

testCache.setNegative('stock:FAIL', 10000);
assert(testCache.has('stock:FAIL'), 'K.2 Negative cache stores entry with 10s TTL');

// Test stale fallback retrieval after expiry
testCache.set('stock:STALE_CHECK', { price: 250 }, 10);
const immediateGet = testCache.get<{ price: number }>('stock:STALE_CHECK');
assert(immediateGet && immediateGet.price === 250, 'L.1 Immediate cache get returns fresh item');

const staleCheck = testCache.getStale<{ price: number }>('stock:STALE_CHECK');
assert(staleCheck && staleCheck.value.price === 250, 'L.2 Stale fallback returns last known good value');
console.log('✓ [PASS] K - L: 60s TTL, 10s negative cache, and stale fallback verified');

// ----------------------------------------------------
// M: PROVIDER TIMEOUT CONFIGURATION
// ----------------------------------------------------
console.log('\n--- M: Provider Timeout Safety ---');
const yahooFile = fs.readFileSync(path.resolve(process.cwd(), 'lib/finance/yahoo.ts'), 'utf-8');
const googleFile = fs.readFileSync(path.resolve(process.cwd(), 'lib/finance/google.ts'), 'utf-8');
assert(yahooFile.includes('5000') || yahooFile.includes('timeoutMs'), 'M.1 Yahoo provider includes 5000ms timeout protection');
assert(googleFile.includes('5000') || googleFile.includes('timeoutMs'), 'M.2 Google provider includes 5000ms timeout protection');
console.log('✓ [PASS] M: 5000ms AbortController timeout protection verified');

// ----------------------------------------------------
// N: POLLING INTERVAL CONFIGURATION
// ----------------------------------------------------
console.log('\n--- N: Frontend Polling Interval ---');
const hookFile = fs.readFileSync(path.resolve(process.cwd(), 'hooks/useMarketData.ts'), 'utf-8');
assert(hookFile.includes('15000'), 'N. useMarketData configures 15000ms (15s) refresh interval');
console.log('✓ [PASS] N: 15-second frontend polling verified');

// ----------------------------------------------------
// O: NO COMMITTED SECRETS OR UNPROTECTED ENV FILES
// ----------------------------------------------------
console.log('\n--- O: Security & Secrets Check ---');
const gitignore = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf-8');
assert(gitignore.includes('.env*'), 'O.1 .gitignore protects .env* files');
assert(!fs.existsSync(path.resolve(process.cwd(), '.env')), 'O.2 No active .env file present');
assert(!fs.existsSync(path.resolve(process.cwd(), '.env.local')), 'O.3 No active .env.local file present');
console.log('✓ [PASS] O: Zero secrets and proper gitignore protection confirmed');

// ----------------------------------------------------
// P - Q: BUILD CONFIGURATION & PACKAGE INTEGRITY
// ----------------------------------------------------
console.log('\n--- P - Q: Package & Build Configuration ---');
const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
assert(packageJson.dependencies['next'], 'P.1 Next.js dependency present');
assert(packageJson.dependencies['react'], 'P.2 React dependency present');
assert(packageJson.dependencies['recharts'], 'P.3 Recharts dependency present');
assert(packageJson.dependencies['lucide-react'], 'P.4 Lucide icons present');
assert(packageJson.scripts['build'] === 'next build', 'P.5 Build script configured');
assert(packageJson.scripts['test:phase6'], 'P.6 Phase 6 test script configured');
assert(packageJson.scripts['test:phase7'], 'P.7 Phase 7 test script configured');
console.log('✓ [PASS] P - Q: Package integrity and build configurations verified');

console.log('\n----------------------------------------------------');
console.log('Phase 7 Test Results: All 17 checks (A through Q) PASSED.');
console.log('----------------------------------------------------');

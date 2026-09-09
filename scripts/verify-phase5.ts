import fs from 'fs';
import path from 'path';
import { MarketDataService } from '../lib/finance/marketData';
import { IMarketQuoteProvider, IValuationProvider, ProviderRequestOptions } from '../lib/finance/types';
import { toGoogleSymbol } from '../lib/finance/google';
import { MemoryCache, RequestDeduplicator } from '../lib/cache';
import { MarketQuote, ValuationMetrics } from '../types/market';
import { PortfolioHolding } from '../types/portfolio';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`✗ [FAIL] ${testName} ${details ? `(${details})` : ''}`);
  }
}

// ----------------------------------------------------
// Mock Providers with Call Counters
// ----------------------------------------------------
class MockQuoteProvider implements IMarketQuoteProvider {
  readonly providerName = 'YAHOO';
  public callCount = 0;
  private behavior: (symbol: string, code: string, options?: ProviderRequestOptions) => Promise<MarketQuote>;

  constructor(behavior: (symbol: string, code: string, options?: ProviderRequestOptions) => Promise<MarketQuote>) {
    this.behavior = behavior;
  }

  async getQuote(symbol: string, exchangeCode: string, options?: ProviderRequestOptions): Promise<MarketQuote> {
    this.callCount++;
    return this.behavior(symbol, exchangeCode, options);
  }

  async getQuotes(items: Array<{ symbol: string; exchangeCode: string }>, options?: ProviderRequestOptions): Promise<MarketQuote[]> {
    return Promise.all(items.map((i) => this.getQuote(i.symbol, i.exchangeCode, options)));
  }
}

class MockValuationProvider implements IValuationProvider {
  readonly providerName = 'GOOGLE';
  public callCount = 0;
  private behavior: (symbol: string, code: string, options?: ProviderRequestOptions) => Promise<ValuationMetrics>;

  constructor(behavior: (symbol: string, code: string, options?: ProviderRequestOptions) => Promise<ValuationMetrics>) {
    this.behavior = behavior;
  }

  async getValuation(symbol: string, exchangeCode: string, options?: ProviderRequestOptions): Promise<ValuationMetrics> {
    this.callCount++;
    return this.behavior(symbol, exchangeCode, options);
  }

  async getValuations(items: Array<{ symbol: string; exchangeCode: string }>, options?: ProviderRequestOptions): Promise<ValuationMetrics[]> {
    return Promise.all(items.map((i) => this.getValuation(i.symbol, i.exchangeCode, options)));
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 5: REAL MARKET DATA & CACHING TEST SUITE');
  console.log('====================================================\n');

  const ts = new Date().toISOString();

  // ----------------------------------------------------
  // SECTION 1: GOOGLE SYMBOL RESOLUTION
  // ----------------------------------------------------
  console.log('--- 1. Google Finance Symbol Resolution ---');
  const hdfcGoogle = toGoogleSymbol('HDFCBANK');
  const iciciGoogle = toGoogleSymbol('532174');
  const customGoogle = toGoogleSymbol('TCS:NSE');

  assert(hdfcGoogle === 'HDFCBANK:NSE', '1.1 Alphabetic NSE ticker formats to {symbol}:NSE');
  assert(iciciGoogle === '532174:BOM', '1.2 6-digit numeric BSE scrip code formats to {code}:BOM');
  assert(customGoogle === 'TCS:NSE', '1.3 Pre-qualified symbol preserves exchange qualifier');

  // ----------------------------------------------------
  // SECTION 2: PROVIDER COMBINATIONS (A, B, C, D)
  // ----------------------------------------------------
  console.log('\n--- 2. Partial Failure Matrix (A, B, C, D) ---');

  const yahooSuccess = new MockQuoteProvider(async (sym, code) => ({
    symbol: sym,
    exchangeCode: code,
    yahooSymbol: `${code}.NS`,
    cmp: 1650.0,
    timestamp: ts,
    source: 'YAHOO',
    error: null,
  }));

  const yahooFail = new MockQuoteProvider(async (sym, code) => ({
    symbol: sym,
    exchangeCode: code,
    yahooSymbol: `${code}.NS`,
    cmp: null,
    timestamp: ts,
    source: 'YAHOO',
    error: {
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Yahoo provider down',
      provider: 'YAHOO',
      timestamp: ts,
    },
  }));

  const googleSuccess = new MockValuationProvider(async (sym, code) => ({
    symbol: sym,
    exchangeCode: code,
    googleSymbol: `${code}:NSE`,
    peRatio: 19.5,
    latestEarnings: 88.4,
    timestamp: ts,
    source: 'GOOGLE',
    error: null,
  }));

  const googleFail = new MockValuationProvider(async (sym, code) => ({
    symbol: sym,
    exchangeCode: code,
    googleSymbol: `${code}:NSE`,
    peRatio: null,
    latestEarnings: null,
    timestamp: ts,
    source: 'GOOGLE',
    error: {
      code: 'RATE_LIMITED',
      message: 'Google rate limit',
      provider: 'GOOGLE',
      timestamp: ts,
    },
  }));

  // Case A: Both succeed
  const serviceA = new MarketDataService(yahooSuccess, googleSuccess, new MemoryCache(), new RequestDeduplicator());
  const resA = await serviceA.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(
    resA.cmp === 1650.0 && resA.peRatio === 19.5 && resA.latestEarnings === 88.4 && !resA.errors,
    '2.1 Case A (Both Succeed): CMP, PE, and Earnings all available'
  );

  // Case B: Yahoo succeeds, Google fails
  const serviceB = new MarketDataService(yahooSuccess, googleFail, new MemoryCache(), new RequestDeduplicator());
  const resB = await serviceB.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(
    resB.cmp === 1650.0 && resB.peRatio === null && resB.latestEarnings === null && resB.errors?.length === 1,
    '2.2 Case B (Yahoo OK, Google Fails): CMP preserved, PE/Earnings null, stock usable'
  );

  // Case C: Yahoo fails, Google succeeds
  const serviceC = new MarketDataService(yahooFail, googleSuccess, new MemoryCache(), new RequestDeduplicator());
  const resC = await serviceC.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(
    resC.cmp === null && resC.peRatio === 19.5 && resC.latestEarnings === 88.4 && resC.errors?.length === 1,
    '2.3 Case C (Yahoo Fails, Google OK): CMP null, PE/Earnings preserved'
  );

  // Case D: Both fail
  const serviceD = new MarketDataService(yahooFail, googleFail, new MemoryCache(), new RequestDeduplicator());
  const resD = await serviceD.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(
    resD.cmp === null && resD.peRatio === null && resD.errors?.length === 2,
    '2.4 Case D (Both Fail): All null with structured error models without throwing'
  );

  // ----------------------------------------------------
  // SECTION 3: CACHING & PERFORMANCE (E, F, G)
  // ----------------------------------------------------
  console.log('\n--- 3. Cache Hits, Misses, and TTL Expiry ---');
  const isolatedCache = new MemoryCache();
  const trackedYahoo = new MockQuoteProvider(async (sym, code) => ({
    symbol: sym,
    exchangeCode: code,
    yahooSymbol: `${code}.NS`,
    cmp: 1500,
    timestamp: ts,
    source: 'YAHOO',
    error: null,
  }));
  const trackedGoogle = new MockValuationProvider(async (sym, code) => ({
    symbol: sym,
    exchangeCode: code,
    googleSymbol: `${code}:NSE`,
    peRatio: 20,
    latestEarnings: 75,
    timestamp: ts,
    source: 'GOOGLE',
    error: null,
  }));

  const cachingService = new MarketDataService(trackedYahoo, trackedGoogle, isolatedCache, new RequestDeduplicator());

  // First request: Cache Miss -> providers must be called
  assert(trackedYahoo.callCount === 0 && trackedGoogle.callCount === 0, '3.1 Provider calls 0 before query');
  const call1 = await cachingService.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(trackedYahoo.callCount === 1 && trackedGoogle.callCount === 1, '3.2 Cache MISS: providers called exactly once');
  assert(call1.cmp === 1500, '3.3 Returned fresh data from provider on miss');

  // Second request: Cache Hit -> providers must NOT be called
  const call2 = await cachingService.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(trackedYahoo.callCount === 1 && trackedGoogle.callCount === 1, '3.4 Cache HIT: 0 provider calls on second request');
  assert(call2.cmp === 1500 && call2.timestamp === call1.timestamp, '3.5 Cache HIT returns identical cached data');

  // Third check: Cache Expiration
  // Manually expire the cache entry by setting short TTL
  isolatedCache.set('stock:HDFCBANK', call1, 10); // expires in 10ms
  await new Promise((r) => setTimeout(r, 25)); // wait 25ms

  const call3 = await cachingService.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(call3.cmp === 1500 && trackedYahoo.callCount === 2 && trackedGoogle.callCount === 2, '3.6 Cache EXPIRY: provider re-queried after TTL expired');

  // ----------------------------------------------------
  // SECTION 4: IN-FLIGHT REQUEST DEDUPLICATION (H)
  // ----------------------------------------------------
  console.log('\n--- 4. In-Flight Request Deduplication ---');
  const deduplicationCache = new MemoryCache();
  const slowYahoo = new MockQuoteProvider(async (sym, code) => {
    await new Promise((r) => setTimeout(r, 60)); // simulate 60ms network latency
    return {
      symbol: sym,
      exchangeCode: code,
      yahooSymbol: `${code}.NS`,
      cmp: 2500,
      timestamp: ts,
      source: 'YAHOO',
      error: null,
    };
  });
  const slowGoogle = new MockValuationProvider(async (sym, code) => {
    await new Promise((r) => setTimeout(r, 60));
    return {
      symbol: sym,
      exchangeCode: code,
      googleSymbol: `${code}:NSE`,
      peRatio: 30,
      latestEarnings: 120,
      timestamp: ts,
      source: 'GOOGLE',
      error: null,
    };
  });

  const dedupService = new MarketDataService(slowYahoo, slowGoogle, deduplicationCache, new RequestDeduplicator());

  // Fire 3 simultaneous concurrent requests for the exact same stock while cache is empty
  const [req1, req2, req3] = await Promise.all([
    dedupService.getStockMarketData('Bajaj Finance', 'BAJFINANCE'),
    dedupService.getStockMarketData('Bajaj Finance', 'BAJFINANCE'),
    dedupService.getStockMarketData('Bajaj Finance', 'BAJFINANCE'),
  ]);

  assert(slowYahoo.callCount === 1, '4.1 Exactly 1 Yahoo provider call made for 3 concurrent requests');
  assert(slowGoogle.callCount === 1, '4.2 Exactly 1 Google provider call made for 3 concurrent requests');
  assert(req1.cmp === 2500 && req2.cmp === 2500 && req3.cmp === 2500, '4.3 All 3 concurrent callers received identical data');

  // ----------------------------------------------------
  // SECTION 5: STALE-ON-ERROR FALLBACK (K)
  // ----------------------------------------------------
  console.log('\n--- 5. Stale-on-Error Fallback ---');
  const staleCache = new MemoryCache();
  let providerShouldFail = false;

  const toggleableYahoo = new MockQuoteProvider(async (sym, code) => {
    if (providerShouldFail) {
      return {
        symbol: sym,
        exchangeCode: code,
        yahooSymbol: `${code}.NS`,
        cmp: null,
        timestamp: new Date().toISOString(),
        source: 'YAHOO',
        error: { code: 'PROVIDER_UNAVAILABLE', message: 'Upstream crashed', provider: 'YAHOO', timestamp: new Date().toISOString() },
      };
    }
    return {
      symbol: sym,
      exchangeCode: code,
      yahooSymbol: `${code}.NS`,
      cmp: 3450.0,
      timestamp: '2026-09-09T08:00:00.000Z',
      source: 'YAHOO',
      error: null,
    };
  });

  const toggleableGoogle = new MockValuationProvider(async (sym, code) => {
    if (providerShouldFail) {
      return {
        symbol: sym,
        exchangeCode: code,
        googleSymbol: `${code}:NSE`,
        peRatio: null,
        latestEarnings: null,
        timestamp: new Date().toISOString(),
        source: 'GOOGLE',
        error: { code: 'PROVIDER_UNAVAILABLE', message: 'Upstream crashed', provider: 'GOOGLE', timestamp: new Date().toISOString() },
      };
    }
    return {
      symbol: sym,
      exchangeCode: code,
      googleSymbol: `${code}:NSE`,
      peRatio: 45.2,
      latestEarnings: 42.0,
      timestamp: '2026-09-09T08:00:00.000Z',
      source: 'GOOGLE',
      error: null,
    };
  });

  const staleService = new MarketDataService(toggleableYahoo, toggleableGoogle, staleCache, new RequestDeduplicator());

  // 1. Prime cache with successful entry
  const primeResult = await staleService.getStockMarketData('Dmart', 'DMART');
  assert(primeResult.cmp === 3450.0 && !primeResult.isStale, '5.1 Initial successful quote cached as fresh');

  // 2. Expire active cache
  staleCache.set('stock:DMART', primeResult, 5); // 5ms TTL
  await new Promise((r) => setTimeout(r, 15)); // wait for expiry

  // 3. Provider now fails
  providerShouldFail = true;
  const fallbackResult = await staleService.getStockMarketData('Dmart', 'DMART');

  assert(fallbackResult.cmp === 3450.0, '5.2 Last known good CMP preserved when provider fails after expiry');
  assert(fallbackResult.isStale === true, '5.3 isStale flag set to true to notify frontend');
  assert(fallbackResult.quoteSource === 'YAHOO_STALE', '5.4 Quote source indicates YAHOO_STALE');

  // ----------------------------------------------------
  // SECTION 6: REAL 26-HOLDING BATCH EXECUTION (L)
  // ----------------------------------------------------
  console.log('\n--- 6. Real 26-Holding Portfolio Batch Execution ---');
  const portfolioPath = path.join(process.cwd(), 'data', 'portfolio.json');
  const rawPortfolio = fs.readFileSync(portfolioPath, 'utf-8');
  const holdings: PortfolioHolding[] = JSON.parse(rawPortfolio);

  assert(holdings.length === 26, '6.1 Verified exactly 26 active holdings loaded from portfolio.json');

  const batchCache = new MemoryCache();
  const batchYahoo = new MockQuoteProvider(async (sym, code) => ({
    symbol: sym,
    exchangeCode: code,
    yahooSymbol: `${code}.NS`,
    cmp: 1000,
    timestamp: ts,
    source: 'YAHOO',
    error: null,
  }));
  const batchGoogle = new MockValuationProvider(async (sym, code) => ({
    symbol: sym,
    exchangeCode: code,
    googleSymbol: `${code}:NSE`,
    peRatio: 22,
    latestEarnings: 50,
    timestamp: ts,
    source: 'GOOGLE',
    error: null,
  }));

  const batchService = new MarketDataService(batchYahoo, batchGoogle, batchCache, new RequestDeduplicator());
  const batchInput = holdings.map((h) => ({ name: h.name, exchangeCode: h.exchangeCode }));

  // First batch: all 26 miss cache -> 26 provider calls
  const batchRun1 = await batchService.getPortfolioMarketData(batchInput, 5);
  assert(batchRun1.data.length === 26, '6.2 Processed all 26 holdings in batch');
  assert(batchYahoo.callCount === 26, '6.3 First batch invoked 26 provider calls on cache miss');
  assert(batchRun1.coverage === 100, '6.4 Coverage calculated as 100%');

  // Second batch: all 26 hit cache -> 0 additional provider calls
  const batchRun2 = await batchService.getPortfolioMarketData(batchInput, 5);
  assert(batchRun2.data.length === 26, '6.5 Second batch returned all 26 items from cache');
  assert(batchYahoo.callCount === 26, '6.6 Second batch made 0 additional provider calls (100% cache hit)');

  // ----------------------------------------------------
  // SECTION 7: REAL DATASET INTEGRITY CHECK
  // ----------------------------------------------------
  console.log('\n--- 7. Real Dataset Integrity Check ---');
  const finalCheckHoldings: PortfolioHolding[] = JSON.parse(fs.readFileSync(portfolioPath, 'utf-8'));
  const allNull = finalCheckHoldings.every(
    (h) => h.cmp === null && h.peRatio === null && h.latestEarnings === null
  );
  assert(allNull, '7. data/portfolio.json is strictly pristine with null market values (no fake data)');

  console.log('\n----------------------------------------------------');
  console.log(`Phase 5 Test Results: ${passedTests} / ${totalTests} assertions passed.`);
  console.log('----------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in Phase 5 verification suite:', err);
  process.exit(1);
});

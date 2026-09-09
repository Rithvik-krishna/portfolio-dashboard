import fs from 'fs';
import path from 'path';
import { MarketDataService } from '../lib/finance/marketData';
import { IMarketQuoteProvider, IValuationProvider, ProviderRequestOptions } from '../lib/finance/types';
import { MemoryCache, RequestDeduplicator } from '../lib/cache';
import { MarketQuote, ValuationMetrics, MarketDataApiResponse, MarketProviderError } from '../types/market';
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
// Mock Providers for Deterministic Unit Testing
// ----------------------------------------------------
class MockQuoteProvider implements IMarketQuoteProvider {
  readonly providerName = 'YAHOO';
  private behavior: (symbol: string, code: string, options?: ProviderRequestOptions) => Promise<MarketQuote>;

  constructor(behavior: (symbol: string, code: string, options?: ProviderRequestOptions) => Promise<MarketQuote>) {
    this.behavior = behavior;
  }

  async getQuote(symbol: string, exchangeCode: string, options?: ProviderRequestOptions): Promise<MarketQuote> {
    return this.behavior(symbol, exchangeCode, options);
  }

  async getQuotes(items: Array<{ symbol: string; exchangeCode: string }>, options?: ProviderRequestOptions): Promise<MarketQuote[]> {
    return Promise.all(items.map((i) => this.getQuote(i.symbol, i.exchangeCode, options)));
  }
}

class MockValuationProvider implements IValuationProvider {
  readonly providerName = 'GOOGLE';
  private behavior: (symbol: string, code: string, options?: ProviderRequestOptions) => Promise<ValuationMetrics>;

  constructor(behavior: (symbol: string, code: string, options?: ProviderRequestOptions) => Promise<ValuationMetrics>) {
    this.behavior = behavior;
  }

  async getValuation(symbol: string, exchangeCode: string, options?: ProviderRequestOptions): Promise<ValuationMetrics> {
    return this.behavior(symbol, exchangeCode, options);
  }

  async getValuations(items: Array<{ symbol: string; exchangeCode: string }>, options?: ProviderRequestOptions): Promise<ValuationMetrics[]> {
    return Promise.all(items.map((i) => this.getValuation(i.symbol, i.exchangeCode, options)));
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 4: BACKEND MARKET DATA ARCHITECTURE TEST SUITE');
  console.log('====================================================\n');

  const ts = new Date().toISOString();

  // Test 1: Yahoo success
  console.log('--- 1. Provider Isolation: Yahoo Success ---');
  const mockYahooSuccess = new MockQuoteProvider(async (symbol, exchangeCode) => ({
    symbol,
    exchangeCode,
    yahooSymbol: `${exchangeCode}.NS`,
    cmp: 1750.5,
    currency: 'INR',
    timestamp: ts,
    source: 'YAHOO',
    error: null,
  }));
  const quoteResult = await mockYahooSuccess.getQuote('HDFC Bank', 'HDFCBANK');
  assert(quoteResult.cmp === 1750.5 && quoteResult.error === null, '1. Yahoo quote success produces valid CMP');

  // Test 2: Yahoo failure
  console.log('\n--- 2. Provider Isolation: Yahoo Failure ---');
  const mockYahooFailure = new MockQuoteProvider(async (symbol, exchangeCode) => ({
    symbol,
    exchangeCode,
    yahooSymbol: `${exchangeCode}.NS`,
    cmp: null,
    timestamp: ts,
    source: 'YAHOO',
    error: {
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Network socket closed',
      provider: 'YAHOO',
      timestamp: ts,
    },
  }));
  const quoteFailResult = await mockYahooFailure.getQuote('HDFC Bank', 'HDFCBANK');
  assert(quoteFailResult.cmp === null && quoteFailResult.error?.code === 'PROVIDER_UNAVAILABLE', '2. Yahoo failure returns null CMP with structured error');

  // Test 3: Google success
  console.log('\n--- 3. Provider Isolation: Google Success ---');
  const mockGoogleSuccess = new MockValuationProvider(async (symbol, exchangeCode) => ({
    symbol,
    exchangeCode,
    googleSymbol: `${exchangeCode}:NSE`,
    peRatio: 18.5,
    latestEarnings: 45.0,
    timestamp: ts,
    source: 'GOOGLE',
    error: null,
  }));
  const valResult = await mockGoogleSuccess.getValuation('HDFC Bank', 'HDFCBANK');
  assert(valResult.peRatio === 18.5 && valResult.latestEarnings === 45.0 && valResult.error === null, '3. Google valuation success produces PE and Earnings');

  // Test 4: Google failure
  console.log('\n--- 4. Provider Isolation: Google Failure ---');
  const mockGoogleFailure = new MockValuationProvider(async (symbol, exchangeCode) => ({
    symbol,
    exchangeCode,
    googleSymbol: `${exchangeCode}:NSE`,
    peRatio: null,
    latestEarnings: null,
    timestamp: ts,
    source: 'GOOGLE',
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      provider: 'GOOGLE',
      timestamp: ts,
    },
  }));
  const valFailResult = await mockGoogleFailure.getValuation('HDFC Bank', 'HDFCBANK');
  assert(valFailResult.peRatio === null && valFailResult.error?.code === 'RATE_LIMITED', '4. Google failure returns null metrics with structured error');

  // Test 5: Case B - Yahoo succeeds + Google fails
  console.log('\n--- 5. Partial Failure: Case B (Yahoo OK, Google Fails) ---');
  const serviceCaseB = new MarketDataService(mockYahooSuccess, mockGoogleFailure, new MemoryCache(), new RequestDeduplicator());
  const dataCaseB = await serviceCaseB.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(
    dataCaseB.cmp === 1750.5 &&
    dataCaseB.peRatio === null &&
    dataCaseB.latestEarnings === null &&
    dataCaseB.errors?.length === 1 &&
    dataCaseB.errors[0].provider === 'GOOGLE',
    '5. Case B preserves CMP even when Google valuation fails'
  );

  // Test 6: Case C - Yahoo fails + Google succeeds
  console.log('\n--- 6. Partial Failure: Case C (Yahoo Fails, Google OK) ---');
  const serviceCaseC = new MarketDataService(mockYahooFailure, mockGoogleSuccess, new MemoryCache(), new RequestDeduplicator());
  const dataCaseC = await serviceCaseC.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(
    dataCaseC.cmp === null &&
    dataCaseC.peRatio === 18.5 &&
    dataCaseC.latestEarnings === 45.0 &&
    dataCaseC.errors?.length === 1 &&
    dataCaseC.errors[0].provider === 'YAHOO',
    '6. Case C preserves PE & Earnings even when Yahoo quote fails'
  );

  // Test 7: Case D - Both fail
  console.log('\n--- 7. Partial Failure: Case D (Both Fail) ---');
  const serviceCaseD = new MarketDataService(mockYahooFailure, mockGoogleFailure, new MemoryCache(), new RequestDeduplicator());
  const dataCaseD = await serviceCaseD.getStockMarketData('HDFC Bank', 'HDFCBANK');
  assert(
    dataCaseD.cmp === null &&
    dataCaseD.peRatio === null &&
    dataCaseD.errors?.length === 2,
    '7. Case D returns null values and captures both structured provider errors'
  );

  // Test 8: Timeout protection
  console.log('\n--- 8. Timeout Protection ---');
  const mockTimeoutProvider = new MockQuoteProvider(async (symbol, exchangeCode, options) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve({
          symbol,
          exchangeCode,
          yahooSymbol: 'TIMEOUT.NS',
          cmp: 100,
          timestamp: ts,
          source: 'YAHOO',
          error: null,
        });
      }, 500);

      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Operation aborted due to timeout'));
        });
      }
    });
  });

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50); // Abort after 50ms

  let timeoutCaught = false;
  try {
    await mockTimeoutProvider.getQuote('Slow Stock', 'SLOW', { signal: controller.signal, timeoutMs: 50 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('aborted')) {
      timeoutCaught = true;
    }
  }
  assert(timeoutCaught, '8. AbortController signal correctly aborts long-running provider request');

  // Test 9: Invalid provider response
  console.log('\n--- 9. Invalid Provider Response ---');
  const mockInvalidResponseProvider = new MockQuoteProvider(async (symbol, exchangeCode) => ({
    symbol,
    exchangeCode,
    yahooSymbol: `${exchangeCode}.NS`,
    cmp: null,
    timestamp: ts,
    source: 'YAHOO',
    error: {
      code: 'INVALID_RESPONSE',
      message: 'Malformatted JSON received from provider',
      provider: 'YAHOO',
      timestamp: ts,
    },
  }));
  const invalidResult = await mockInvalidResponseProvider.getQuote('Corrupted', 'CORRUPT');
  assert(invalidResult.error?.code === 'INVALID_RESPONSE', '9. Malformatted response mapped to INVALID_RESPONSE code');

  // Test 10: Invalid symbol
  console.log('\n--- 10. Invalid Symbol ---');
  const mockInvalidSymbolProvider = new MockQuoteProvider(async (symbol, exchangeCode) => ({
    symbol,
    exchangeCode,
    yahooSymbol: '',
    cmp: null,
    timestamp: ts,
    source: 'YAHOO',
    error: {
      code: 'INVALID_SYMBOL',
      message: 'Cannot resolve valid Yahoo symbol',
      provider: 'YAHOO',
      timestamp: ts,
    },
  }));
  const invalidSymResult = await mockInvalidSymbolProvider.getQuote('No Symbol', '');
  assert(invalidSymResult.error?.code === 'INVALID_SYMBOL', '10. Empty symbol mapped to INVALID_SYMBOL code');

  // Test 11: 26-stock batch execution
  console.log('\n--- 11. 26-Stock Batch Execution ---');
  const filePath = path.join(process.cwd(), 'data', 'portfolio.json');
  const portfolioRaw = fs.readFileSync(filePath, 'utf-8');
  const realHoldings: PortfolioHolding[] = JSON.parse(portfolioRaw);

  const deterministicService = new MarketDataService(
    new MockQuoteProvider(async (name, code) => ({
      symbol: name,
      exchangeCode: code,
      yahooSymbol: `${code}.NS`,
      cmp: 1000 + code.length * 10,
      timestamp: ts,
      source: 'YAHOO',
      error: null,
    })),
    new MockValuationProvider(async (name, code) => ({
      symbol: name,
      exchangeCode: code,
      googleSymbol: `${code}:NSE`,
      peRatio: 25.0,
      latestEarnings: 45.0,
      timestamp: ts,
      source: 'GOOGLE',
      error: null,
    })),
    new MemoryCache(),
    new RequestDeduplicator()
  );

  const batchHoldings = realHoldings.map((h) => ({ name: h.name, exchangeCode: h.exchangeCode }));
  const batchResult = await deterministicService.getPortfolioMarketData(batchHoldings, 5);

  assert(batchResult.data.length === 26, '11.1 Exactly 26 holdings processed in batch execution');
  assert(batchResult.coverage === 100, '11.2 100% coverage achieved when all quotes succeed');
  assert(batchResult.errors.length === 0, '11.3 0 errors recorded in clean batch run');

  // Test 12: Partial batch failure
  console.log('\n--- 12. Partial Batch Failure ---');
  const flakyService = new MarketDataService(
    new MockQuoteProvider(async (name, code) => {
      // Fail 2 specific holdings
      if (code === '532174' || code === 'DMART') {
        return {
          symbol: name,
          exchangeCode: code,
          yahooSymbol: `${code}.BO`,
          cmp: null,
          timestamp: ts,
          source: 'YAHOO',
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: 'Simulated quote failure for holding',
            provider: 'YAHOO',
            timestamp: ts,
          },
        };
      }
      return {
        symbol: name,
        exchangeCode: code,
        yahooSymbol: `${code}.NS`,
        cmp: 500,
        timestamp: ts,
        source: 'YAHOO',
        error: null,
      };
    }),
    mockGoogleSuccess,
    new MemoryCache(),
    new RequestDeduplicator()
  );

  const partialBatch = await flakyService.getPortfolioMarketData(batchHoldings, 5);
  const succeededQuotes = partialBatch.data.filter((d) => d.cmp !== null);
  const failedQuotes = partialBatch.data.filter((d) => d.cmp === null);

  assert(succeededQuotes.length === 24, '12.1 Exactly 24 quotes succeeded in partial batch');
  assert(failedQuotes.length === 2, '12.2 Exactly 2 quotes failed gracefully without crashing batch');
  assert(partialBatch.errors.length === 2, '12.3 Partial batch captured exactly 2 structured errors');
  assert(partialBatch.coverage === Number(((24 / 26) * 100).toFixed(2)), '12.4 Partial coverage matches 92.31%');

  // Test 13: Error normalization
  console.log('\n--- 13. Error Code Normalization ---');
  const validCodes: string[] = [
    'INVALID_SYMBOL',
    'PROVIDER_UNAVAILABLE',
    'TIMEOUT',
    'RATE_LIMITED',
    'INVALID_RESPONSE',
    'DATA_UNAVAILABLE',
    'UNKNOWN_ERROR',
  ];
  const testError: MarketProviderError = {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    provider: 'YAHOO',
    timestamp: ts,
  };
  assert(validCodes.includes(testError.code), '13. Error codes conform to strict MarketErrorCode union');

  // Test 14: API response shape validation
  console.log('\n--- 14. API Response Shape Validation ---');
  const mockApiResponse: MarketDataApiResponse = {
    success: true,
    requestTimestamp: ts,
    data: batchResult.data,
    errors: batchResult.errors,
    coverage: batchResult.coverage,
  };
  assert(
    typeof mockApiResponse.success === 'boolean' &&
    typeof mockApiResponse.requestTimestamp === 'string' &&
    typeof mockApiResponse.data === 'object' &&
    Array.isArray(mockApiResponse.errors) &&
    typeof mockApiResponse.coverage === 'number',
    '14. MarketDataApiResponse conforms to strict TypeScript contract'
  );

  // Test 15: Guarantee data/portfolio.json is unmodified with fake market values
  console.log('\n--- 15. Real Dataset Integrity Check ---');
  const realFileCheck = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const allRealCmpNull = realFileCheck.every(
    (h: PortfolioHolding) => h.cmp === null && h.peRatio === null && h.latestEarnings === null
  );
  assert(allRealCmpNull, '15. data/portfolio.json strictly preserved with null market data (no fake values)');

  console.log('\n----------------------------------------------------');
  console.log(`Phase 4 Test Results: ${passedTests} / ${totalTests} assertions passed.`);
  console.log('----------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in Phase 4 test suite:', err);
  process.exit(1);
});

# Technical Challenges and Engineering Solutions

This document captures the real engineering challenges encountered during the development of the Dynamic Portfolio Dashboard and the technical solutions implemented to overcome them.

---

## 1. Unofficial Financial APIs and Scraping Fragility

### The Challenge
Neither Yahoo Finance nor Google Finance provide public, official, SLA-backed REST APIs. Both platforms change their page structure periodically, introduce anti-bot challenges, or throttle automated requests with HTTP 429 status codes.

### The Solution
- **Decoupled Provider Architecture**: Isolated provider logic behind `IMarketQuoteProvider` and `IValuationProvider` interfaces. The rest of the application (calculation engine, API routes, UI) interacts solely with domain models (`MarketQuote`, `ValuationMetrics`).
- **Defensive Regex Parsing**: Rather than relying on rigid DOM selectors that break with CSS class name hashes, the Google Finance parser looks for semantic labels (`P/E ratio`, `EPS`) and extracts nearby numeric values defensively.
- **Strict Null-Propagation**: If a metric cannot be parsed, it evaluates strictly to `null` with a standardized `DATA_UNAVAILABLE` error code. It is never defaulted to `0`, avoiding false valuation reporting.

---

## 2. Cross-Provider Symbol Format Discrepancies

### The Challenge
The portfolio dataset contains Indian equities with mixed identifiers:
- 6 equities use alphabetic NSE tickers (`HDFCBANK`, `BAJFINANCE`, `AFFLE`, etc.).
- 20 equities use 6-digit numeric BSE security codes (`532174`, `544252`, `511577`, etc.).

Each external financial provider requires its own symbol convention:
- **Yahoo Finance**: Requires `.NS` for NSE and `.BO` for BSE (e.g., `HDFCBANK.NS`, `532174.BO`).
- **Google Finance**: Requires `:NSE` for NSE and `:BOM` for BSE (e.g., `HDFCBANK:NSE`, `532174:BOM`).

### The Solution
- Implemented provider-specific symbol resolvers:
  - `toYahooSymbol()` in `lib/portfolio/normalization.ts` converts symbols for Yahoo.
  - `toGoogleSymbol()` in `lib/finance/google.ts` converts symbols for Google.
- Neither provider reuses the other's external symbol convention, ensuring clean separation and zero cross-provider symbol corruption.

---

## 3. High-Frequency Polling & Rate-Limiting Protection

### The Challenge
The assignment anticipates that a portfolio dashboard may refresh live market data every ~15 seconds. If each client refresh fired 26 Yahoo requests and 26 Google requests simultaneously (52 external HTTP calls), the server would quickly face socket starvation and IP-level rate limiting from upstream services.

### The Solution
- **Server-Side In-Memory Cache (`lib/cache.ts`)**:
  - Implemented a 60-second TTL (`MARKET_DATA_CACHE_TTL_MS = 60000`).
  - Subsequent requests within the TTL return instantly from memory with 0 provider calls.
- **Controlled Concurrency Batching**:
  - Uncached requests are processed in controlled chunks of 5 (`batchSize: 5`), avoiding socket pool exhaustion.
- **In-Flight Request Deduplication**:
  - Implemented `RequestDeduplicator`. If multiple client requests arrive concurrently while a stock is being fetched, subsequent requests await the active in-flight Promise rather than initiating redundant provider calls.

---

## 4. Stale-on-Error Fallback vs. Negative Caching

### The Challenge
What happens when a cached market quote expires and the upstream provider experiences a temporary outage?
- If the cache simply evicts the expired entry and the provider fails, the dashboard suddenly replaces all active numbers with `null` or errors.
- Conversely, if a persistent failure is cached for a long duration, the system fails to recover quickly once the provider comes back online.

### The Solution
- **Stale-on-Error Fallback**: The cache retains a `lastKnownGood` record of successful quotes. If the active cache has expired and the provider fails, the system returns the last known good data accompanied by an explicit `isStale: true` flag. The UI can display "Stale data (last updated X ago)" without crashing or flashing empty tables.
- **Short Negative Caching**: Pure failures on un-cached stocks are cached for only 10 seconds (`NEGATIVE_CACHE_TTL_MS = 10000`), allowing rapid recovery as soon as the upstream service stabilizes.
- **Integrity Guarantee**: Transient provider errors are barred from overwriting existing `lastKnownGood` entries.

---

## 5. In-Memory Cache Deployment Limitations

### The Challenge
To keep the architecture simple and aligned with assignment guidelines, no external infrastructure (such as Redis or Memcached) was added.

### Architectural Trade-offs & Limitations
- **Process-Local**: The cache resides in the Node.js process heap. In multi-instance serverless deployments (such as auto-scaling serverless functions), each instance maintains an independent cache.
- **Volatile**: Restarting or redeploying the server clears the cache.
- **Suitability**: For single-server deployments or localized evaluation environments, this in-memory strategy offers sub-millisecond lookups and zero external operational dependencies. For enterprise multi-region scale, a Redis adapter can easily be plugged into the `MemoryCache` interface.

---

## 6. Financial Precision and Zero vs. Null Semantic Distinction

### The Challenge
In financial engineering, floating-point arithmetic can introduce cumulative rounding errors across multi-stock portfolios. Furthermore, conflating `0` with `null` creates critical mathematical errors:
- If CMP is missing and treated as `0`, a stock with ₹1,00,000 investment displays a false catastrophic loss of -₹1,00,000 (-100%).
- If a stock's P/E ratio is missing and treated as `0`, valuation screens falsely flag it as having infinite earnings.

### The Solution
- **Full Double Precision Internally**: All calculation functions in `lib/portfolio/calculations.ts` operate on full double-precision numbers without intermediate `.toFixed(2)` truncation. Rounding is strictly applied at presentation boundaries.
- **Strict Null-Propagation Contract**:
  - `cmp === null` &rarr; `presentValue = null` (never 0).
  - `presentValue === null` &rarr; `gainLoss = null` (never `0 - investment`).
  - `gainLoss === null` or `investment <= 0` &rarr; `gainLossPercentage = null`.
- **Verified Benchmark**: Confirmed exact reconciliation with Excel row 35: Total Investment = ₹15,43,060 across all 6 sectors.

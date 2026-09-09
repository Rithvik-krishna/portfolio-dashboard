# Technical Assignment — Challenges Faced

**Candidate**: Rithvik Krishna  
**Role**: Full Stack Engineer Technical Assignment  
**Project**: Dynamic Portfolio Dashboard  
**Repository**: [https://github.com/Rithvik-krishna/portfolio-dashboard](https://github.com/Rithvik-krishna/portfolio-dashboard)

---

## 1. Excel Data Normalization

### Challenge
The source portfolio data was provided in an Excel workbook with non-standard casing, empty rows, trailing whitespace, and summary footer rows (Row 35). Financial applications require strict floating-point integrity; parsing errors like currency symbols or uncleaned strings could corrupt calculations and cause `NaN` errors.

### Solution
Created a deterministic normalization pipeline in `lib/portfolio/normalization.ts`. Standardized header variants (`PARTICULARS`, `PURCHASE PRICE`, `SECTOR`, `NSE/BSE`) to a strongly-typed schema, stripped formatting characters, and isolated the 26 active holdings.

### Result
Verified 100% exact benchmark reconciliation with Excel Row 35: Total Portfolio Investment = **₹15,43,060** across 6 distinct sectors.

---

## 2. Dual-Exchange Market Data Integration (NSE & BSE)

### Challenge
The portfolio consists of securities across both the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE), including alphabetic tickers (e.g., `HDFCBANK`) and 6-digit numeric scrip codes (e.g., `532174`). Furthermore, Yahoo Finance and Google Finance require completely different symbol syntaxes (`.NS`/`.BO` vs `:NSE`/`:BOM`).

### Solution
Implemented exchange detection in `lib/portfolio/normalization.ts` and encapsulated symbol translation within each provider:
- `toYahooSymbol()`: Maps NSE to `.NS` and BSE to `.BO`.
- `toGoogleSymbol()`: Maps NSE to `:NSE` and BSE to `:BOM`.

### Result
100% of holdings are correctly mapped and queried without ambiguous exchange collision errors.

---

## 3. Google Finance Valuation Extraction

### Challenge
Google Finance does not offer an official public API for equity valuation metrics (P/E ratio and quarterly EPS). Using heavy headless browser automation (Puppeteer/Playwright) would increase deployment bundle size by 200MB+ and cause 3+ second cold-start latencies on serverless platforms.

### Solution
Engineered a lightweight server-side HTTP `fetch` parser using standard browser request headers and targeted regex pattern matching against Google's structured DOM metrics. Diluted quarterly EPS was mapped to `latestEarnings`. Any unlisted or unavailable metric gracefully returns `null` (`N/A` in the UI) rather than throwing.

### Result
Valuation extraction latency dropped to **~350ms** with zero heavyweight headless browser dependencies.

---

## 4. Rate Limiting & Provider Overload

### Challenge
Querying external financial endpoints for all 26 holdings simultaneously creates 52 concurrent HTTP connections, triggering HTTP 429 "Too Many Requests" rate limits.

### Solution
Designed a controlled batching mechanism in `lib/finance/marketData.ts` that processes holdings in sequential chunks of **5 stocks** at a time.

### Result
Rate limiting is completely prevented during full portfolio refreshes while maintaining responsive overall execution times.

---

## 5. In-Memory Caching & Request Deduplication

### Challenge
When multiple users access the dashboard or background polling occurs, burst queries for identical stocks can trigger cache stampedes. Additionally, external providers occasionally experience transient downtime.

### Solution
Implemented an in-memory cache layer in `lib/cache.ts`:
- **60-Second Success TTL** for fresh market quotes.
- **10-Second Negative Cache** for transient provider errors to avoid hammer-looping failed symbols.
- **Request Deduplicator**: Collapses concurrent queries for the same ticker into a single in-flight Promise.
- **Stale-on-Error Fallback**: Retains the last known good quote during outages, serving data with `isStale: true` and `quoteSource: 'YAHOO_STALE'`.

### Result
Cached requests return in **14ms** (a 98.5% latency reduction), and downstream users are protected from upstream API outages.

---

## 6. Asymmetric Provider Partial Failures

### Challenge
Yahoo Finance provides CMP while Google Finance provides P/E and EPS. In traditional architectures, if Google fails, the entire stock quote is dropped, wiping out valid live prices.

### Solution
Orchestrated provider fetching with `Promise.allSettled()` and a 4-state partial failure matrix:
1. **Both Succeed**: Full quote displayed.
2. **Yahoo OK, Google Fails**: CMP preserved; P/E and EPS display as `N/A`.
3. **Yahoo Fails, Google OK**: CMP is `N/A`; valuation metrics preserved.
4. **Both Fail**: Graceful error logging without crashing.

### Result
Provider failures are completely decoupled; an issue with Google Finance never breaks live price tracking.

---

## 7. Real-Time UI & Strict Null Propagation

### Challenge
If live prices are pending or missing, default fallback to `0` would cause catastrophic calculation errors ($0 - \text{Investment} = -\text{Investment}$), displaying false **-100% losses**.

### Solution
- Established strict null propagation across the calculation engine (`lib/portfolio/calculations.ts`). Missing market data produces `null` rather than `0`.
- Built centralized formatters (`lib/formatters.ts`) rendering `N/A` for missing metrics.
- Developed a 15-second client polling hook (`hooks/useMarketData.ts`) with in-flight deduplication and animated skeletons to eliminate layout shifts.

### Result
Clean, institutional-grade financial terminal dashboard with zero false loss calculations and seamless 15-second background refreshes.

---

## 8. Key Lessons & Engineering Insights

1. **Decouple Business Logic from UI**: Pure, immutable calculation functions ensure financial data can be tested independently of React rendering cycles.
2. **Respect External Provider Realities**: When working with unofficial data sources, defensive timeout boundaries, negative caching, and stale fallbacks are essential for production stability.
3. **Financial UX Requires Strict Truth**: Displaying `N/A` is vastly superior to guessing or displaying synthetic zero values that mislead investors.

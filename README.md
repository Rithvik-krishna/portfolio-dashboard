# Dynamic Portfolio Dashboard

Full-stack financial portfolio dashboard built for the Octa Byte AI Technical Assignment with Next.js (App Router), React, TypeScript, and Tailwind CSS.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to explore the dashboard.

### 3. Run Automated Verification Suites
```bash
# Phase 2: Excel Ingestion & Normalization verification (14 tests)
npm run test:phase2

# Phase 3: Calculation Engine Hardening & Determinism verification (83 tests)
npm run test:phase3

# Phase 4: Market Data Backend Architecture verification (20 tests)
npm run test:phase4

# Phase 5: Real Market Data, Google Finance & Caching verification (27 tests)
npm run test:phase5
```

### 4. Build for Production
```bash
npm run build
```

---

## Market Data Architecture

The market data subsystem connects the frontend with external financial data sources through a decoupled server-side provider pattern.

### Request Flow
```
Browser / Frontend
       │
       ▼
Next.js API Route (GET /api/market-data)
       │
       ▼
MarketDataService (lib/finance/marketData.ts)
       │
       ▼
MemoryCache (lib/cache.ts)
       ├── Cache Hit (Fresh) ──► Return Cached Immediately (0 provider calls)
       └── Cache Miss / Stale
               │
               ▼
       Request Deduplicator (Awaits in-flight requests for identical stocks)
               │
               ▼
       Promise.allSettled (Concurrent Execution & Batch Control)
              ├── YahooQuoteProvider.getQuote()           (lib/finance/yahoo.ts)
              │     └── Uses canonical toYahooSymbol() (.NS / .BO) + AbortController (5000ms)
              └── GoogleValuationProvider.getValuation()  (lib/finance/google.ts)
                    └── Uses canonical toGoogleSymbol() (:NSE / :BOM) + AbortController (5000ms)
               │
               ▼
       Combine & Apply Partial Failure Matrix
               ├── Success ──► Cache with 60s TTL
               └── Failure ──► Fall back to Stale Cache (isStale: true) or 10s Negative Cache
               │
               ▼
       JSON API Response (MarketDataApiResponse)
```

---

## Google Finance Strategy

### 1. Data Acquisition Method
- Google Finance does **not** provide an official public API.
- Data is retrieved server-side via lightweight HTTP `fetch` targeting `https://www.google.com/finance/quote/{symbol}:{exchange}` with browser `User-Agent` and `Accept-Language` headers.
- **Zero Browser Automation Overhead**: No heavy dependencies like Puppeteer or Playwright are introduced, ensuring compatibility with standard container and serverless runtimes.

### 2. Symbol Resolution
- **NSE Tickers**: Formatted as `{ticker}:NSE` (e.g., `HDFCBANK:NSE`, `BAJFINANCE:NSE`).
- **BSE Security Codes**: 6-digit numeric codes format as `{code}:BOM` (e.g., `532174:BOM`).

### 3. Parsing & Metric Mapping
- **P/E Ratio**: Extracted defensively using semantic regex matching against Google Finance HTML. Missing values or dashes normalize strictly to `null` (never `0`).
- **Latest Earnings (EPS Mapping)**: Google Finance reports quarterly Earnings Per Share (EPS) in its primary key metrics grid. This value is mapped directly to `StockMarketData.latestEarnings`.
- **Fragility Disclaimer**: Being an unofficial HTML-based scraper, page structure updates or anti-bot CAPTCHAs by Google can cause extractions to fail gracefully with `DATA_UNAVAILABLE` or `PROVIDER_UNAVAILABLE`.

---

## Caching Strategy

To protect upstream providers and ensure rapid client dashboard response times, an in-memory cache (`lib/cache.ts`) guards all market data calls.

### 1. Cache Architecture & TTL
- **Success TTL (`MARKET_DATA_CACHE_TTL_MS = 60000`)**: Successful quotes are cached in memory for 60 seconds. Client requests within this window return in sub-milliseconds without triggering external requests.
- **Negative Cache (`NEGATIVE_CACHE_TTL_MS = 10000`)**: Transient errors are cached for 10 seconds to prevent rapid error loops while allowing quick auto-recovery once services stabilize.
- **Deterministic Keys**: Formatted as `yahoo:quote:{symbol}`, `google:val:{symbol}`, and `stock:{symbol}` to prevent cross-provider collisions.

### 2. Stale-on-Error Fallback
- If an active cache entry expires and subsequent external provider calls fail, the cache preserves the `lastKnownGood` record.
- The service returns the last known good market data tagged with `isStale: true`. The UI can display a stale warning rather than failing or showing blanks.
- Transient errors are prevented from overwriting the `lastKnownGood` history.

### 3. Request Deduplication
- Multiple concurrent requests for the same holding share a single in-flight Promise via `RequestDeduplicator`.
- Three parallel requests for `HDFCBANK` result in exactly **1** provider HTTP call, with all three callers receiving the settled result.

### 4. Deployment Limitations
- **Process-Local**: Stored in process memory. Cache state is independent per serverless instance and resets upon server restart.
- **Zero Infrastructure**: Operates cleanly without requiring external Redis or database setups.

---

## Rate Limiting & Concurrency Control

- **Batch Chunking**: `MarketDataService.getPortfolioMarketData()` partitions the 26 portfolio holdings into controlled batches of 5 (`batchSize: 5`).
- **Socket Protection**: Prevents firing 52 simultaneous socket requests to external providers.
- **Timeout Enforcers**: All network calls carry an explicit 5,000ms `AbortController` timeout to prevent hanging connections.

---

## API Endpoints

- **`GET /api/portfolio`**: Returns normalized portfolio holdings along with calculated baseline investments, portfolio weights, and sector aggregations.
- **`GET /api/market-data`**: Returns live market quotes, P/E ratios, and EPS for all 26 holdings (supports `?symbols=HDFCBANK,532174` filter). Includes `coverage`, `isStale`, and structured provider errors.

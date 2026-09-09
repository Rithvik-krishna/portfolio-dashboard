# Loom Video Technical Walkthrough Script (5–8 Minutes)

**Project**: Dynamic Portfolio Dashboard  
**Candidate**: Rithvik Krishna  
**Audience**: 8byte Engineering Reviewers  

---

### [0:00 – 0:30] Project Overview
> *"Hello! My name is Rithvik Krishna, and this is my technical walkthrough for the Dynamic Portfolio Dashboard assignment. The goal of this project was to take a real Excel portfolio of 26 Indian equities across 6 sectors, ingest and normalize the data with mathematical precision, fetch real-time market quotes from Yahoo Finance and Google Finance, and deliver a high-density, institutional-grade financial monitoring terminal built with Next.js App Router, React, TypeScript, Tailwind CSS, and Recharts."*

**Visual**: Show the live dashboard running on `http://localhost:3000`. Point out the header, 4 KPI cards, 2 Recharts charts, and the 11-column holdings table.

---

### [0:30 – 1:15] Excel Ingestion & Normalized Data
> *"Let's start with data ingestion. In `lib/portfolio/normalization.ts`, we parse the source Excel sheet. Rather than inventing mock stocks or hardcoding numbers, we extract the exact 26 active holdings. Notice that Row 35 of the Excel sheet totals ₹15,43,060. Our normalization pipeline strips non-standard headers, whitespace, and subtotal rows to arrive at this exact ₹15,43,060 baseline benchmark. In `data/portfolio.json`, all market fields like CMP, P/E, and EPS are strictly initialized as `null`—we never fabricate live market data."*

**Visual**: Open `data/portfolio.json` in VS Code and briefly show the clean holding schema with `cmp: null`.

---

### [1:15 – 2:00] Deterministic Calculation Engine
> *"Moving to the business logic: in `lib/portfolio/calculations.ts` and `grouping.ts`, we implement an immutable calculation engine. All financial math—Investment, Present Value, Unrealized Gain/Loss, Portfolio Weight, and Sector Aggregations—lives here as pure, deterministic functions. React components never perform financial calculations. Most importantly, we implemented strict null propagation. If CMP is missing, Present Value is `null`, and Gain/Loss is `null`. A naive calculation defaulting to zero would evaluate $0 - \text{Investment}$, falsely showing a 100% loss. Here, it cleanly displays as `N/A`."*

**Visual**: Show `lib/portfolio/calculations.ts` highlighting `calculatePresentValue` and `calculatePortfolioSummary`.

---

### [2:00 – 3:00] Market Data Providers (Yahoo & Google Finance)
> *"For market data, we built a decoupled provider architecture under `lib/finance/`. We have two providers:
> 1. `YahooQuoteProvider`: Retrieves live CMP. It automatically resolves NSE tickers by appending `.NS` and BSE scrip codes with `.BO`.
> 2. `GoogleValuationProvider`: Google Finance does not offer a public REST API, so we built a lightweight server-side scraper using standard HTTP `fetch` and regex pattern matching for P/E ratio and quarterly EPS. No heavy headless browsers like Puppeteer were used, keeping server execution fast and memory usage minimal.
> 
> In `lib/finance/marketData.ts`, both providers are queried concurrently using `Promise.allSettled()`. This guarantees that if Google Finance has an issue, Yahoo's live price still updates the user's present value seamlessly."*

**Visual**: Show `lib/finance/yahoo.ts` and `lib/finance/google.ts` with `AbortController` 5000ms timeouts.

---

### [3:00 – 4:00] Caching, Deduplication & Rate Limiting
> *"To protect against external rate limits and ensure sub-second response times, we built `lib/cache.ts`:
> - First, a 60-second in-memory cache for successful quotes.
> - Second, a 10-second negative cache for transient provider errors to prevent hammer loops.
> - Third, an in-flight Request Deduplicator: if 5 users or rapid refreshes query the same stock simultaneously, they share the single pending network Promise.
> - Fourth, a Stale-on-Error fallback: if an external provider goes down after cache expiration, we preserve the last known good quote and flag it as `isStale: true`.
> In our live terminal tests, a cold fetch takes ~900ms, while a cache hit takes just 14ms—a 98.5% latency reduction."*

**Visual**: Show the terminal benchmark output where Call 1 took ~900ms and Call 2 took 14ms.

---

### [4:00 – 5:00] Frontend Dashboard & Visualizations
> *"Now let's examine the user interface. In `app/page.tsx`, we built a responsive, dark-theme financial terminal:
> - The Header displays a real-time status badge (`● LIVE`, `↻ UPDATING`, or `⚠ STALE DATA`) along with relative update times and data coverage.
> - 4 Summary KPI Cards: Total Investment (₹15,43,060), Current Value, Total Gain/Loss, and Overall Return with semantic colors.
> - Two Recharts charts: A Sector Allocation Donut Chart showing capital distribution, and a Sector Performance Bar Chart comparing Investment vs Current Value.
> - The Holdings Table includes all 11 columns required by the assignment, grouped by the 6 sectors. Each sector accordion is collapsible, and its open/closed state is preserved during background refreshes."*

**Visual**: Demonstrate the live browser UI: expand and collapse a sector, hover over the Recharts tooltips, and click the manual refresh button.

---

### [5:00 – 6:00] Real-Time 15s Refresh & Error Handling
> *"Under the hood, `hooks/useMarketData.ts` handles client-side real-time polling every 15 seconds. It connects to `/api/market-data`, merges live prices into the immutable calculation engine, and updates state without any full page reload. If a background refresh encounters a network glitch, the dashboard never blanks out; it gracefully preserves the existing market data and displays an unobtrusive status notice."*

**Visual**: Show `hooks/useMarketData.ts` with the 15-second interval and in-flight guard ref.

---

### [6:00 – 7:00] Testing & Verification Suite
> *"Reliability is guaranteed through automated tests. We created dedicated test suites for every phase:
> - `npm run test:phase2`: Excel ingestion (14 tests)
> - `npm run test:phase3`: Calculation engine math and edge cases (83 tests)
> - `npm run test:phase4`: Market data providers and partial failure matrix (20 tests)
> - `npm run test:phase5`: Google scraping, deduplication, and cache TTLs (27 tests)
> - `npm run test:phase6`: UI contracts, formatters, and production cleanliness (30+ tests)
> - `npm run test:phase7`: Final QA, security audit, and route verification (17 checks)
> In total, over 190 automated assertions pass. ESLint is clean with zero errors and zero warnings, and `npm run build` succeeds cleanly."*

**Visual**: Run `npm run test:phase7` in the terminal to show all checks passing.

---

### [7:00 – 8:00] Technical Challenges & Trade-offs
> *"To conclude, I'd like to highlight three key engineering trade-offs:
> 1. Lightweight scraping vs. Headless browsers: We chose HTTP `fetch` with regex over Puppeteer. The trade-off is susceptibility to DOM changes, but the payoff is a 10x faster response time and instant serverless cold starts.
> 2. In-memory caching vs. Redis: We kept the cache process-local to avoid introducing unneeded infrastructure, accepting instance isolation in serverless deployments.
> 3. Strict financial truth: We never invent or approximate missing CMP or EPS values. If data is unlisted, it displays as `N/A`.
> 
> The codebase is fully documented in `README.md`, `TECHNICAL_CHALLENGES.md`, and ready for deployment. Thank you for your time!"*

**Visual**: Show the clean GitHub repository and conclude the recording.

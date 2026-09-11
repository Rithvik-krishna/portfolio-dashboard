# Loom Video Technical Walkthrough Script (5–7 Minutes)

**Project**: Dynamic Portfolio Dashboard  
**Candidate**: Rithvik Krishna  
**Audience**: 8byte Engineering Reviewers  
**Live URL**: [Vercel Deployment URL]  
**Repository**: [GitHub Repository URL]

---

### [0:00 – 0:45] 1. Project Overview & Live Deployment
> *"Hello! My name is Rithvik Krishna, and this is my technical walkthrough for the Dynamic Portfolio Dashboard assignment. The goal of this project is to take a real Excel portfolio of 26 Indian equities across 6 sectors, ingest and normalize the data with mathematical precision, fetch real-time market quotes from Yahoo Finance and Google Finance, and deliver a high-density, institutional-grade financial monitoring terminal.
> 
> The application is built using Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, and Recharts, and is deployed live on Vercel with serverless API route handlers."*

**On-Screen Action**: 
- Show the live dashboard running on Vercel (or `http://localhost:3000`).
- Point out the top status header with the live market indicator, 4 summary KPI cards, 2 Recharts charts, and the 11-column sector-grouped portfolio table.

---

### [0:45 – 1:30] 2. Excel Ingestion & Normalized Data Model
> *"Let's start with data ingestion. In `lib/portfolio/normalization.ts`, we parse the source Excel sheet. Rather than inventing mock stocks or hardcoding numbers, we extract the exact 26 active holdings. 
> 
> In the source sheet, Row 35 totals ₹15,43,060. Our ingestion pipeline cleans headers, trims trailing whitespace, resolves exchange codes, and validates against that exact ₹15,43,060 baseline benchmark. In `data/portfolio.json`, all volatile market fields—like CMP, P/E, and EPS—are strictly initialized as `null`. We never fabricate live market data into static assets."*

**On-Screen Action**: 
- Open `data/portfolio.json` in VS Code to briefly show the clean holding schema with `cmp: null`.
- Briefly show `scripts/verify-phase2.ts` passing 14/14 benchmark checks.

---

### [1:30 – 2:30] 3. Deterministic Calculation Engine
> *"For business logic, we established a strict architectural rule: React components never perform financial calculations. 
> 
> All math lives in pure, deterministic functions in `lib/portfolio/calculations.ts` and `grouping.ts`. We calculate Total Investment, Present Value, Unrealized Gain/Loss, Portfolio Weight, and Sector Aggregations.
> 
> A critical feature here is strict null propagation. If CMP is missing or pending, Present Value is `null`, and Gain/Loss is `null`. A naive calculation that defaults missing CMP to zero would calculate (0 - Investment), falsely telling the investor they lost 100% of their capital. In our terminal, it cleanly renders as `N/A`."*

**On-Screen Action**: 
- Open `lib/portfolio/calculations.ts` highlighting `calculatePresentValue`, `deriveHoldingMetrics`, and `calculatePortfolioSummary`.

---

### [2:30 – 3:30] 4. Market Data Architecture & The Real-World Yahoo Glitch Fix
> *"For live data, we built a decoupled provider architecture under `lib/finance/`:
> 1. `YahooQuoteProvider`: Fetches CMP using Yahoo's v8 chart endpoint, resolving NSE tickers with `.NS` and BSE scrip codes with `.BO`.
> 2. `GoogleValuationProvider`: Google Finance has no public REST API, so we built a resilient server-side scraper using standard HTTP `fetch` and regex pattern matching to extract P/E ratio and latest earnings without heavy headless browser overhead.
> 
> During live testing, we caught a critical real-world bug: Yahoo Finance's API returned a corrupted market price of ₹10,60,33,28,500 (~₹10.6 Billion) for Fine Organic (`541557.BO`), which distorted our ₹15 Lakh portfolio into a ₹1.69 Lakh Crore position!
> 
> Instead of patching the JSON file, we built an institutional defensive layer in `lib/finance/marketValidation.ts`. It validates equity CMP against non-finite values, positive numbers, an absolute ₹10 Lakh cap, and a 50x purchase price deviation limit. Corrupted prices are safely rejected, protecting the entire portfolio from financial distortion."*

**On-Screen Action**: 
- Open `lib/finance/marketValidation.ts` to show `validateMarketPrice`.
- Show how Fine Organic displays cleanly with CMP as `N/A`, P/E preserved, and portfolio total unaffected.

---

### [3:30 – 4:30] 5. Caching, Concurrency & Rate Limiting
> *"To ensure sub-second response times and prevent IP bans from external financial endpoints, we built `lib/finance/cache.ts` and `marketData.ts`:
> - First, a 60-second positive in-memory cache for live quotes.
> - Second, a 10-second negative cache for missing or unlisted scrips to prevent tight retry loops.
> - Third, an in-flight Request Deduplicator: if multiple polling cycles or users request the same stock simultaneously, they share a single network Promise.
> - Fourth, Stale-on-Error Fallback: if an upstream provider fails, we preserve the last known good quote marked as `isStale: true`.
> - Fifth, controlled batch concurrency: tickers are processed in chunks of 5 rather than firing 26 parallel requests."*

**On-Screen Action**: 
- Show `lib/finance/cache.ts` and the controlled batch concurrency loop in `lib/finance/marketData.ts`.

---

### [4:30 – 5:30] 6. Frontend Terminal UI & Dynamic 15s Polling
> *"Looking at the UI in `app/page.tsx`:
> - The Header provides an active live pulse badge (`● LIVE`), last sync timestamp, and stock coverage counter.
> - 4 Summary KPI Cards highlight Total Investment, Current Value, and Total Return with clear color cues.
> - Two interactive Recharts widgets display Sector Asset Allocation via a Donut chart and Sector Performance via a Bar chart.
> - The 11-column Portfolio Table groups stocks by sector with collapsible accordions that preserve their open/closed state across background refreshes.
> - In `hooks/useMarketData.ts`, a 15-second `setInterval` polls `/api/market-data` in the background with in-flight deduplication, recalculating portfolio metrics via React's `useMemo` with zero UI flicker or layout shifts."*

**On-Screen Action**: 
- Interact with the UI: collapse and expand sectors, hover over Recharts tooltips, and click the manual "Refresh" button to demonstrate the live refresh spinner.

---

### [5:30 – 6:15] 7. Automated Verification Suite & Conclusion
> *"Quality and reproducibility are backed by over 200 automated assertions:
> - `npm run test:phase2`: Excel benchmark verification (14 tests)
> - `npm run test:phase3`: Pure calculation engine math & rounding (83 tests)
> - `npm run test:phase4`: Provider architecture & partial failure isolation (20 tests)
> - `npm run test:phase5`: Google Finance scraping & caching behavior (27 tests)
> - `npm run test:phase6`: Dashboard formatting & UI components (30 tests)
> - `npm run test:phase7`: Security, route validation, and audit (17 tests)
> - `npm run test:validation`: Market sanity validation & anomaly rejection (13 tests)
> 
> The project builds cleanly with 0 TypeScript errors and 0 ESLint warnings. Thank you for your time and consideration!"*

**On-Screen Action**: 
- Run `npm run test:validation` or `npm run test:phase7` in the terminal to show all green checks passing.
- Conclude the recording on the clean GitHub repository or live Vercel dashboard.


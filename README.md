# Dynamic Portfolio Dashboard

A high-density, institutional-grade financial portfolio dashboard built for the **Octa Byte AI Full Stack Engineer Technical Assignment**. 

Engineered with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Recharts**, this platform monitors 26 real equity holdings across 6 sectors with pure mathematical determinism, real-time market data ingestion, resilient server-side caching, and graceful fallback handling.

---

## 🎥 Video Walkthrough & Technical Documentation

| Resource | Link | Description |
| :--- | :--- | :--- |
| 🎥 **Loom Video Walkthrough** | [**Watch Video**](https://www.loom.com/share/8b92ec47dd8845af81ca44ec2ca4545d) | 5–7 min architecture deep-dive & live demo |
| 📄 **Challenges Faced Document** | [**View Document**](https://drive.google.com/file/d/1ZICFI_42C9Ham7kpbKqK8-7WgnlG3G_F/view?usp=sharing) | Comprehensive engineering challenges & solutions report |

### 🎥 Loom Video Walkthrough
[![Watch Technical Walkthrough](https://img.shields.io/badge/Loom-Watch%20Technical%20Walkthrough-625DF5?style=for-the-badge&logo=loom&logoColor=white)](https://www.loom.com/share/8b92ec47dd8845af81ca44ec2ca4545d)  
▶️ **Direct Link**: [https://www.loom.com/share/8b92ec47dd8845af81ca44ec2ca4545d](https://www.loom.com/share/8b92ec47dd8845af81ca44ec2ca4545d)

### 📄 Technical Assignment — Challenges Faced
[![Google Drive Document](https://img.shields.io/badge/Google%20Drive-Challenges%20Faced%20Document-4285F4?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/file/d/1ZICFI_42C9Ham7kpbKqK8-7WgnlG3G_F/view?usp=sharing)  
▶️ **Direct Link**: [https://drive.google.com/file/d/1ZICFI_42C9Ham7kpbKqK8-7WgnlG3G_F/view?usp=sharing](https://drive.google.com/file/d/1ZICFI_42C9Ham7kpbKqK8-7WgnlG3G_F/view?usp=sharing)

---

## 8byte Technical Assignment Coverage

| Requirement | Implementation Details | Status |
| :--- | :--- | :--- |
| **Excel Portfolio Ingestion** | Extracted from `F9001561_ADDBA737E8_B72562937A.xlsx` into normalized `data/portfolio.json`. | **COMPLIANT** |
| **Active Holdings & Capital** | Exactly 26 active holdings across 6 sectors; ₹15,43,060 Total Investment benchmark matches row 35. | **COMPLIANT** |
| **Dynamic Calculation Engine** | Pure, immutable financial formulas in `lib/portfolio/calculations.ts` & `grouping.ts`. | **COMPLIANT** |
| **NSE / BSE Exchange Handling** | Dual-exchange normalization (`toYahooSymbol`, `toGoogleSymbol`, `detectExchange`). | **COMPLIANT** |
| **Current Market Price (CMP)** | Live CMP retrieval via Yahoo Finance with 5000ms timeout protection. | **COMPLIANT** |
| **Present Value & Gain/Loss** | Deterministic derivation; strict null propagation prevents `0 - Investment` anomalies. | **COMPLIANT** |
| **P/E Ratio & Latest Earnings** | Real-time web extraction via Google Finance key statistics; clean `N/A` handling for unlisted data. | **COMPLIANT** |
| **Portfolio Weight & Sectors** | Investment-based portfolio weighting; 100% mathematical reconciliation across all 6 sectors. | **COMPLIANT** |
| **Real-Time 15s Refresh** | Client-side polling hook (`useMarketData.ts`) updating data every ~15s without full-page reloads. | **COMPLIANT** |
| **Server-Side Caching** | 60s success TTL, 10s negative cache, request deduplication, and stale-on-error fallback. | **COMPLIANT** |
| **Interactive Visualizations** | Recharts Donut (`PortfolioAllocation`) and Bar Chart (`SectorPerformance`). | **COMPLIANT** |
| **Responsive 11-Column Table** | High-density financial tabular layout with collapsible sector accordions. | **COMPLIANT** |
| **No Fabricated Data** | Strictly zero synthetic CMP/PE values in source data; unavailable values render as `N/A`. | **COMPLIANT** |

---

## Architecture Overview

```
                          ┌───────────────────────────────┐
                          │   Browser / Client Dashboard  │
                          │   (http://localhost:3000)     │
                          └──────────────┬────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │ Polling every ~15s                      │ Initial SSR
                    ▼                                         ▼
        ┌───────────────────────┐                 ┌───────────────────────┐
        │  GET /api/market-data │                 │   GET /api/portfolio  │
        └───────────┬───────────┘                 └───────────┬───────────┘
                    │                                         │
                    ▼                                         ▼
        ┌─────────────────────────────────────────────────────────┐
        │       MarketDataService Orchestrator Layer              │
        └───────────┬─────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   MemoryCache Engine  │ ──► Cache Hit (<15ms) ──► Return to Client
        └───────────┬───────────┘
                    │ Cache Miss / Expired
                    ▼
        ┌───────────────────────┐
        │  Request Deduplicator │ (Collapses concurrent in-flight queries)
        └───────────┬───────────┘
                    │
                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │  Controlled Concurrency Batch Execution (Chunk Size: 5) │
        │                    Promise.allSettled                   │
        ├────────────────────────────┬────────────────────────────┤
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────────┐        ┌───────────────────┐       ┌─────────────────┐
│YahooQuoteProvider │        │GoogleValuation    │       │Stale-on-Error   │
│(CMP Retrieval)    │        │Provider (P/E, EPS)│       │Fallback Store   │
│5000ms AbortTimer  │        │5000ms AbortTimer  │       │(isStale: true)  │
└───────────────────┘        └───────────────────┘       └─────────────────┘
```

---

## Project Structure

```
dynamic-portfolio-dashboard/
├── app/
│   ├── api/
│   │   ├── market-data/route.ts   # Cached real-time market data endpoint
│   │   └── portfolio/route.ts     # Normalized portfolio source endpoint
│   ├── globals.css                # Tailwind CSS v4 design tokens
│   ├── layout.tsx                 # Root HTML shell & metadata
│   └── page.tsx                   # Production Dashboard View
├── components/
│   ├── charts/
│   │   ├── PortfolioAllocation.tsx# Recharts Donut chart (sector weights)
│   │   └── SectorPerformance.tsx  # Recharts Bar chart (investment vs value)
│   ├── dashboard/
│   │   ├── DashboardHeader.tsx    # Header & real-time market status badge
│   │   ├── MarketStatus.tsx       # Live, Stale, Updating status ticker
│   │   ├── PortfolioRow.tsx       # 11-column tabular holding row
│   │   ├── PortfolioSummary.tsx   # 4 financial KPI metric cards
│   │   ├── PortfolioTable.tsx     # Full table container with expand/collapse
│   │   └── SectorSection.tsx      # Collapsible sector accordion
│   └── ui/
│       ├── Badge.tsx              # NSE/BSE & status indicators
│       ├── ErrorState.tsx         # Non-disruptive refresh error notice
│       └── Skeleton.tsx           # Layout-shift-free loading skeletons
├── data/
│   └── portfolio.json             # 26 normalized holdings (pristine null market fields)
├── hooks/
│   └── useMarketData.ts           # 15s polling hook with deduplication & fallback
├── lib/
│   ├── cache.ts                   # In-memory cache, negative cache & deduplicator
│   ├── formatters.ts              # Indian currency (₹), percentage & time formatters
│   ├── finance/
│   │   ├── google.ts              # Google Finance scraper & symbol resolution
│   │   ├── logger.ts              # Sanitized server development logger
│   │   ├── marketData.ts          # MarketDataService orchestrator
│   │   ├── types.ts               # Provider interfaces (IMarketQuoteProvider, etc.)
│   │   └── yahoo.ts               # Yahoo Finance CMP provider
│   └── portfolio/
│       ├── calculations.ts        # Pure, deterministic financial calculation engine
│       ├── grouping.ts            # Sector grouping & reconciliation
│       ├── normalization.ts       # Excel header and symbol normalization
│       └── validation.ts          # Domain validation rules
├── scripts/
│   ├── verify-phase2.ts           # Ingestion verification (14 tests)
│   ├── verify-phase3.ts           # Calculation engine verification (83 tests)
│   ├── verify-phase4.ts           # Market backend architecture (20 tests)
│   ├── verify-phase5.ts           # Google scraping & cache verification (27 tests)
│   ├── verify-phase6.ts           # Production UI & formatter tests
│   └── verify-phase7.ts           # Final QA & security hardening tests (17 checks)
├── types/
│   ├── market.ts                  # Market domain contracts & error unions
│   └── portfolio.ts               # Holding, Summary, and Sector contracts
└── package.json                   # Scripts, dependencies, and metadata
```

---

## Data Pipeline & Calculation Engine

All financial formulas live exclusively in `lib/portfolio/calculations.ts` and `lib/portfolio/grouping.ts`. React components never calculate investments, returns, or sector aggregates.

### Financial Formulas
1. **Investment Amount**: $\text{Investment} = \text{Purchase Price} \times \text{Quantity}$
2. **Present Value**: $\text{Present Value} = \text{CMP} \times \text{Quantity}$ *(returns `null` if CMP is unavailable)*
3. **Unrealized Gain / Loss**: $\text{Gain/Loss} = \text{Present Value} - \text{Investment}$ *(returns `null` if CMP is unavailable)*
4. **Gain / Loss Percentage**: $\text{Gain/Loss \%} = \frac{\text{Gain/Loss}}{\text{Investment}} \times 100$
5. **Portfolio Weight**: $\text{Weight} = \frac{\text{Holding Investment}}{\text{Total Portfolio Investment}} \times 100$

### Null-Propagation Contract
If market data is pending or unavailable:
- CMP = `null` $\rightarrow$ Present Value = `null` $\rightarrow$ Gain/Loss = `null`.
- In the user interface, `null` is rendered as a clean `N/A`.
- Under no circumstances does the engine evaluate $0 - \text{Investment}$ (which would falsely display a 100% loss).

---

## Market Data Providers & Scraping Disclosure

### Yahoo Finance Provider (`lib/finance/yahoo.ts`)
- Retrieves live CMP via Yahoo Finance JSON endpoint.
- Maps symbols canonically: NSE tickers append `.NS` (e.g., `HDFCBANK.NS`), BSE scrips append `.BO` (e.g., `532174.BO`).
- Bound with `AbortController` (5000ms timeout) and 429 rate-limit status handling.

### Google Finance Provider (`lib/finance/google.ts`) & Public Disclosure
- **Important Disclosure**: Google Finance does not provide an official public API for equity valuation metrics. The application uses lightweight server-side HTTP `fetch` with browser headers and regex extraction.
- **Symbol Disambiguation**:
  - 6-digit numeric BSE scrip codes (e.g., `532174`) map to `{code}:BOM`.
  - Alphabetic tickers (e.g., `HDFCBANK`) map to `{ticker}:NSE`.
- **Latest Earnings Semantics**: Google Finance publishes quarterly Diluted EPS in its key statistics grid. This quarterly EPS value is mapped to `StockMarketData.latestEarnings`. When unlisted or negative, it cleanly defaults to `null` (`N/A` in UI). **No values are fabricated.**

---

## Caching, Deduplication & Rate Limiting

1. **In-Memory Cache (`lib/cache.ts`)**:
   - **Success TTL**: 60 seconds.
   - **Negative Cache TTL**: 10 seconds for transient failures to avoid hammer-looping failed symbols.
   - **Stale-on-Error Fallback**: A dedicated `lastKnownGood` cache retains successful quotes. If an upstream provider fails after TTL expiration, the last known quote is returned with `isStale: true` and `quoteSource: 'YAHOO_STALE'`.
2. **In-Flight Request Deduplication**:
   - `RequestDeduplicator` tracks pending Promises. Burst queries for the same ticker share the same network call. Promises are evicted in `.finally()` to prevent error poisoning.
3. **Controlled Provider Concurrency**:
   - Batch requests are chunked into sequential groups of **5 holdings**, eliminating burst-triggered HTTP 429 rate limits.
4. **Deployment Limitation**:
   - The cache is process-local in-memory storage. In serverless multi-region deployments or cold restarts, instances maintain independent cache lifetimes.

---

## API Reference

### `GET /api/portfolio`
Returns the normalized 26-holding portfolio with baseline calculation engine metrics.
- **Response**: `PortfolioHolding[]` (26 objects, market fields are `null`).

### `GET /api/market-data`
Retrieves live market data quotes and valuation metrics.
- **Query Parameters**:
  - `symbols` *(optional)*: Comma-separated list of exchange codes (e.g., `?symbols=HDFCBANK,DMART`). Sanitized, deduplicated, and bounded to max 50 tokens.
- **Response Envelope**:
```json
{
  "success": true,
  "requestTimestamp": "2026-09-09T08:49:05.880Z",
  "data": [
    {
      "symbol": "Dmart",
      "exchangeCode": "DMART",
      "cmp": 3742,
      "peRatio": 79.84,
      "latestEarnings": null,
      "timestamp": "2026-09-09T08:49:04.974Z",
      "cachedAt": "2026-09-09T08:49:05.863Z",
      "quoteSource": "YAHOO",
      "valuationSource": "GOOGLE"
    }
  ],
  "errors": [],
  "coverage": 100,
  "isStale": false
}
```

---

## Running Locally

### Prerequisites
- Node.js 18.18+ or 20+ (tested on Node.js v22.14.0)
- npm 9+

### 1. Installation
```bash
git clone https://github.com/Rithvik-krishna/portfolio-dashboard.git
cd portfolio-dashboard
npm install
```

### 2. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Execution
```bash
npm run build
npm run start
```

---

## Automated Verification Suites

The repository contains 6 comprehensive automated test suites covering all phases:

```bash
# Phase 2: Excel Data Ingestion & Benchmark Verification (14 tests)
npm run test:phase2

# Phase 3: Calculation Engine Math & Precision Hardening (83 tests)
npm run test:phase3

# Phase 4: Market Data Architecture & Partial Failure Matrix (20 tests)
npm run test:phase4

# Phase 5: Google Scraping, In-Memory Cache & Fallback (27 tests)
npm run test:phase5

# Phase 6: UI Production Cleanliness & Financial Formatters (30+ tests)
npm run test:phase6

# Phase 7: Final QA, Security, Build & Route Audit (17 tests)
npm run test:phase7
```

**Total Automated Assertions**: Over **190+ automated tests passed**.

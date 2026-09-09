# Submission Screenshot Checklist

To ensure a comprehensive visual record of the implementation for your submission to 8byte, capture the following 9 screenshots:

---

### 1. Main Dashboard Overview
- **URL**: `http://localhost:3000` (Desktop View ~1440px)
- **What to capture**: Full viewport showing the header, 4 KPI Summary Cards, both Recharts visualizations, and the top sector of the holdings table.
- **Key Details to verify**:
  - Total Investment shows **₹15,43,060**
  - Current Value, Total Gain/Loss, and Return are populated with live/cached values
  - Status indicator shows `● LIVE` with relative timestamp

---

### 2. Portfolio Holdings Table
- **URL**: `http://localhost:3000`
- **What to capture**: The full 11-column holdings table with sectors expanded.
- **Key Details to verify**:
  - Column headers: Stock, Purchase, Qty, Investment, Weight, Exch, CMP, Present Val, Gain/Loss, P/E, Latest EPS
  - Clean monospace right-alignment for numerical data
  - NSE / BSE badge tags
  - Positive values in emerald (+), negative in rose (-), missing in muted `N/A`

---

### 3. Sector Allocation Donut Chart
- **URL**: `http://localhost:3000`
- **What to capture**: Hover state over a segment of the Recharts Sector Allocation Donut Chart.
- **Key Details to verify**:
  - Tooltip renders: Sector Name, Total Investment in ₹, Weight %, and Holding Count
  - Legend displays all 6 sectors (Financial, Tech, Consumer, Power, Pipe, Others)

---

### 4. Sector Performance Bar Chart
- **URL**: `http://localhost:3000`
- **What to capture**: The Sector Performance chart comparing Investment vs Current Value.
- **Key Details to verify**:
  - Dual bar comparisons per sector
  - Y-axis formatted in compact Indian denominations (e.g. ₹1.5L, ₹3.0L)
  - Tooltip showing exact figures on hover

---

### 5. Real-Time Market Status & Refresh
- **URL**: `http://localhost:3000`
- **What to capture**: Close-up of the header right-hand corner during or after refresh.
- **Key Details to verify**:
  - Pulsing live green dot (`● LIVE`) or updating spinner (`↻ UPDATING`)
  - Relative update time (e.g., `Updated 8s ago`)
  - Coverage pill showing `100% coverage (26/26)`

---

### 6. Mobile / Responsive Layout
- **URL**: `http://localhost:3000` (Simulated in Chrome DevTools at 390px width — iPhone 14)
- **What to capture**:
  - Vertically stacked KPI summary cards
  - Full-width charts
  - Horizontally scrollable holdings table showing all columns without layout clipping

---

### 7. API JSON Responses
- **URL**: `http://localhost:3000/api/market-data?symbols=HDFCBANK,DMART`
- **What to capture**: Formatted JSON response in browser or terminal.
- **Key Details to verify**:
  - `success: true`
  - `requestTimestamp` and `cachedAt` fields
  - `quoteSource: 'YAHOO'` and `valuationSource: 'GOOGLE'`
  - Clean null handling where metrics are unlisted

---

### 8. Complete Test Suite Execution
- **Command**: Terminal running `npm run test:phase2 && npm run test:phase3 && npm run test:phase4 && npm run test:phase5 && npm run test:phase6 && npm run test:phase7`
- **What to capture**: Terminal output showing all test suites passing with green checkmarks.
- **Key Details to verify**: Over 190+ automated assertions passed.

---

### 9. Production Build Success
- **Command**: `npm run build`
- **What to capture**: Terminal output showing successful Next.js Turbopack compilation.
- **Key Details to verify**:
  - `✓ Compiled successfully`
  - Zero TypeScript errors
  - Route tree showing static `/` and dynamic `/api/market-data` and `/api/portfolio`

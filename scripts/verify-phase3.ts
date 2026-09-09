import fs from 'fs';
import path from 'path';
import { PortfolioHolding } from '../types/portfolio';
import {
  calculateInvestment,
  calculatePresentValue,
  calculateGainLoss,
  calculateGainLossPercentage,
  calculatePortfolioWeight,
  deriveHoldingMetrics,
  calculatePortfolioWeights,
  hydratePortfolio,
  calculatePortfolioSummary,
} from '../lib/portfolio/calculations';
import { groupBySector, calculateSectorSummaries } from '../lib/portfolio/grouping';

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

function runTests() {
  console.log('====================================================');
  console.log('PHASE 3: CALCULATION ENGINE HARDENING TEST SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // SECTION 1: INVESTMENT CALCULATIONS
  // ----------------------------------------------------
  console.log('--- 1. Investment Calculations ---');
  assert(calculateInvestment(100, 10) === 1000, '1.1 Normal purchase price and integer quantity');
  assert(calculateInvestment(1459.6, 50) === 72980, '1.2 Decimal purchase price calculation');
  assert(calculateInvestment(24, 1080) === 25920, '1.3 Large quantity with lower price');
  assert(calculateInvestment(0, 10) === 0, '1.4 Zero purchase price returns 0');
  assert(calculateInvestment(100, 0) === 0, '1.5 Zero quantity returns 0');
  assert(calculateInvestment(-50, 10) === 0, '1.6 Negative purchase price guarded (returns 0)');
  assert(calculateInvestment(100, -5) === 0, '1.7 Negative quantity guarded (returns 0)');
  assert(calculateInvestment(NaN, 10) === 0, '1.8 NaN purchase price guarded (returns 0)');
  assert(calculateInvestment(100, Infinity) === 0, '1.9 Infinity quantity guarded (returns 0)');
  assert(calculateInvestment(null, 10) === 0, '1.10 Null purchase price guarded (returns 0)');

  // ----------------------------------------------------
  // SECTION 2: PRESENT VALUE
  // ----------------------------------------------------
  console.log('\n--- 2. Present Value Calculations ---');
  assert(calculatePresentValue(150, 10) === 1500, '2.1 Valid CMP and quantity');
  assert(calculatePresentValue(null, 10) === null, '2.2 CMP === null strictly returns null (NEVER zero)');
  assert(calculatePresentValue(undefined, 10) === null, '2.3 CMP === undefined returns null');
  assert(calculatePresentValue(0, 10) === 0, '2.4 CMP === 0 returns 0 (worthless stock)');
  assert(calculatePresentValue(-100, 10) === null, '2.5 Negative CMP returns null');
  assert(calculatePresentValue(100, 0) === null, '2.6 Zero quantity returns null for PV');
  assert(calculatePresentValue(NaN, 10) === null, '2.7 NaN CMP returns null');
  assert(calculatePresentValue(Infinity, 10) === null, '2.8 Infinity CMP returns null');

  // ----------------------------------------------------
  // SECTION 3: GAIN / LOSS
  // ----------------------------------------------------
  console.log('\n--- 3. Gain / Loss Calculations ---');
  assert(calculateGainLoss(1500, 1000) === 500, '3.1 Profit condition (PV > Inv)');
  assert(calculateGainLoss(800, 1000) === -200, '3.2 Loss condition (PV < Inv)');
  assert(calculateGainLoss(1000, 1000) === 0, '3.3 Break-even condition (PV === Inv)');
  assert(calculateGainLoss(null, 1000) === null, '3.4 Missing PV strictly returns null (NEVER 0 - Inv)');
  assert(calculateGainLoss(1500, null) === null, '3.5 Missing Investment returns null');
  assert(calculateGainLoss(NaN, 1000) === null, '3.6 NaN PV returns null');
  assert(calculateGainLoss(1500, Infinity) === null, '3.7 Infinity investment returns null');

  // ----------------------------------------------------
  // SECTION 4: GAIN / LOSS PERCENTAGE
  // ----------------------------------------------------
  console.log('\n--- 4. Gain / Loss Percentage Calculations ---');
  assert(calculateGainLossPercentage(500, 1000) === 50, '4.1 Positive return (50%)');
  assert(calculateGainLossPercentage(-200, 1000) === -20, '4.2 Negative return (-20%)');
  assert(calculateGainLossPercentage(0, 1000) === 0, '4.3 Break-even return (0%)');
  assert(calculateGainLossPercentage(null, 1000) === null, '4.4 Null gain/loss returns null');
  assert(calculateGainLossPercentage(500, 0) === null, '4.5 Division by zero investment returns null (No Infinity)');
  assert(calculateGainLossPercentage(500, -100) === null, '4.6 Negative investment returns null');
  assert(calculateGainLossPercentage(NaN, 1000) === null, '4.7 NaN gain/loss returns null');
  assert(!isNaN(calculateGainLossPercentage(100, 300) as number), '4.8 Result is never NaN');

  // ----------------------------------------------------
  // SECTION 5: PORTFOLIO WEIGHT
  // ----------------------------------------------------
  console.log('\n--- 5. Portfolio Weight Calculations ---');
  assert(calculatePortfolioWeight(1000, 1000) === 100, '5.1 Single holding allocation equals 100%');
  assert(calculatePortfolioWeight(250, 1000) === 25, '5.2 Normal proportional allocation (25%)');
  assert(calculatePortfolioWeight(100, 0) === 0, '5.3 Zero total investment returns 0 (No Infinity/NaN)');
  assert(calculatePortfolioWeight(-100, 1000) === 0, '5.4 Negative investment returns 0');

  const testHoldingsForWeights: PortfolioHolding[] = [
    { id: '1', name: 'A', purchasePrice: 100, quantity: 2, exchangeCode: 'A', sector: 'Tech' },
    { id: '2', name: 'B', purchasePrice: 100, quantity: 3, exchangeCode: 'B', sector: 'Tech' },
    { id: '3', name: 'C', purchasePrice: 100, quantity: 5, exchangeCode: 'C', sector: 'Tech' },
  ];
  const weighted = calculatePortfolioWeights(testHoldingsForWeights);
  const totalWeight = weighted.reduce((sum, h) => sum + (h.portfolioWeight ?? 0), 0);
  assert(Math.abs(totalWeight - 100) < 0.0001, '5.5 Sum of portfolio weights equals 100%');

  // ----------------------------------------------------
  // SECTION 6: DATA STATES & PORTFOLIO SUMMARY
  // ----------------------------------------------------
  console.log('\n--- 6. Data States & Portfolio Summary ---');

  // State 1: Source data only (All CMP null)
  const state1Holdings: PortfolioHolding[] = [
    { id: '1', name: 'Stock A', purchasePrice: 100, quantity: 10, exchangeCode: 'A', sector: 'Sec1', cmp: null },
    { id: '2', name: 'Stock B', purchasePrice: 200, quantity: 5, exchangeCode: 'B', sector: 'Sec2', cmp: null },
  ];
  const summary1 = calculatePortfolioSummary(state1Holdings);
  assert(summary1.dataState === 'SOURCE_ONLY', '6.1 State 1 identified as SOURCE_ONLY');
  assert(summary1.totalInvestment === 2000, '6.2 State 1 total investment correct (2000)');
  assert(summary1.totalPresentValue === null, '6.3 State 1 totalPresentValue is strictly null');
  assert(summary1.totalGainLoss === null, '6.4 State 1 totalGainLoss is strictly null');
  assert(summary1.marketDataCoverage === 0, '6.5 State 1 market coverage is 0%');
  assert(!summary1.isMarketDataComplete, '6.6 State 1 isMarketDataComplete is false');

  // State 2: Complete market data
  const state2Holdings: PortfolioHolding[] = [
    { id: '1', name: 'Stock A', purchasePrice: 100, quantity: 10, exchangeCode: 'A', sector: 'Sec1', cmp: 120 },
    { id: '2', name: 'Stock B', purchasePrice: 200, quantity: 5, exchangeCode: 'B', sector: 'Sec2', cmp: 180 },
  ];
  const summary2 = calculatePortfolioSummary(state2Holdings);
  assert(summary2.dataState === 'COMPLETE_MARKET', '6.7 State 2 identified as COMPLETE_MARKET');
  assert(summary2.totalInvestment === 2000, '6.8 State 2 total investment correct (2000)');
  assert(summary2.totalPresentValue === 2100, '6.9 State 2 total present value correct (1200 + 900 = 2100)');
  assert(summary2.totalGainLoss === 100, '6.10 State 2 total gain/loss correct (100)');
  assert(summary2.totalGainLossPercentage === 5, '6.11 State 2 gain/loss % correct (5%)');
  assert(summary2.marketDataCoverage === 100, '6.12 State 2 market coverage is 100%');
  assert(summary2.isMarketDataComplete, '6.13 State 2 isMarketDataComplete is true');

  // State 3: Partial market data
  const state3Holdings: PortfolioHolding[] = [
    { id: '1', name: 'Stock A', purchasePrice: 100, quantity: 10, exchangeCode: 'A', sector: 'Sec1', cmp: 150 }, // Inv 1000, PV 1500
    { id: '2', name: 'Stock B', purchasePrice: 200, quantity: 5, exchangeCode: 'B', sector: 'Sec2', cmp: null }, // Inv 1000, PV null
  ];
  const summary3 = calculatePortfolioSummary(state3Holdings);
  assert(summary3.dataState === 'PARTIAL_MARKET', '6.14 State 3 identified as PARTIAL_MARKET');
  assert(summary3.marketDataCoverage === 50, '6.15 State 3 market coverage is 50%');
  assert(!summary3.isMarketDataComplete, '6.16 State 3 isMarketDataComplete is false');
  assert(summary3.totalPresentValue === 1500, '6.17 State 3 sums only available present values');
  assert(summary3.totalGainLoss === 500, '6.18 State 3 calculates gain/loss relative to available holdings only');

  // ----------------------------------------------------
  // SECTION 7: SECTOR SUMMARY & RECONCILIATION
  // ----------------------------------------------------
  console.log('\n--- 7. Sector Summary & Reconciliation ---');
  const sectorTestHoldings: PortfolioHolding[] = [
    { id: '1', name: 'Fin1', purchasePrice: 100, quantity: 5, exchangeCode: 'F1', sector: 'Finance', cmp: 120 },
    { id: '2', name: 'Fin2', purchasePrice: 200, quantity: 5, exchangeCode: 'F2', sector: 'Finance', cmp: null },
    { id: '3', name: 'Tech1', purchasePrice: 500, quantity: 2, exchangeCode: 'T1', sector: 'Tech', cmp: 600 },
  ];
  const sectorSummaries = calculateSectorSummaries(sectorTestHoldings);
  assert(sectorSummaries.length === 2, '7.1 Exactly 2 sectors grouped');

  const finSector = sectorSummaries.find((s) => s.sector === 'Finance');
  const techSector = sectorSummaries.find((s) => s.sector === 'Tech');

  assert(finSector?.totalInvestment === 1500, '7.2 Finance sector total investment is 1500');
  assert(techSector?.totalInvestment === 1000, '7.3 Tech sector total investment is 1000');
  assert(finSector?.marketDataCoverage === 50, '7.4 Finance sector market coverage is 50%');
  assert(!finSector?.isMarketDataComplete, '7.5 Finance sector isMarketDataComplete is false');
  assert(techSector?.marketDataCoverage === 100, '7.6 Tech sector market coverage is 100%');
  assert(techSector?.isMarketDataComplete === true, '7.7 Tech sector isMarketDataComplete is true');

  const sectorInvSum = sectorSummaries.reduce((sum, s) => sum + s.totalInvestment, 0);
  assert(sectorInvSum === 2500, '7.8 Sum of sector investments matches total portfolio investment (2500)');

  const sectorWeightSum = sectorSummaries.reduce((sum, s) => sum + s.portfolioWeight, 0);
  assert(Math.abs(sectorWeightSum - 100) < 0.0001, '7.9 Sum of sector weights equals 100%');

  // ----------------------------------------------------
  // SECTION 8: IMMUTABILITY & PURE FUNCTIONS
  // ----------------------------------------------------
  console.log('\n--- 8. Immutability & Pure Functions ---');
  const originalHolding: Readonly<PortfolioHolding> = Object.freeze({
    id: 'freeze-1',
    name: 'Frozen Holding',
    purchasePrice: 100,
    quantity: 10,
    exchangeCode: 'FRZ',
    sector: 'FrozenSector',
    cmp: null,
  });

  const hydratedSingle = deriveHoldingMetrics(originalHolding, 1000);
  assert(originalHolding.investment === undefined, '8.1 Original object investment is untouched (pure function)');
  assert(hydratedSingle.investment === 1000, '8.2 Derived object has calculated investment');
  assert(hydratedSingle !== originalHolding, '8.3 Returns a brand new object reference');

  const frozenArray: ReadonlyArray<PortfolioHolding> = Object.freeze([originalHolding]);
  const hydratedArray = hydratePortfolio(frozenArray);
  assert(hydratedArray.length === 1 && hydratedArray[0] !== originalHolding, '8.4 hydratePortfolio does not mutate input array');

  const grouped = groupBySector(frozenArray);
  assert(grouped['FrozenSector'][0] !== originalHolding, '8.5 groupBySector creates fresh copies');

  // ----------------------------------------------------
  // SECTION 9: NUMERICAL SAFETY
  // ----------------------------------------------------
  console.log('\n--- 9. Numerical Safety Guardrails ---');
  const badHoldings: PortfolioHolding[] = [
    { id: 'b1', name: 'Bad1', purchasePrice: NaN, quantity: 10, exchangeCode: 'B1', sector: 'Bad' },
    { id: 'b2', name: 'Bad2', purchasePrice: 100, quantity: Infinity, exchangeCode: 'B2', sector: 'Bad' },
  ];
  const hydratedBad = hydratePortfolio(badHoldings);
  const badHasNaN = hydratedBad.some((h) => Object.values(h).some((v) => typeof v === 'number' && isNaN(v)));
  const badHasInf = hydratedBad.some((h) => Object.values(h).some((v) => typeof v === 'number' && !isFinite(v)));
  assert(!badHasNaN, '9.1 Guarded against NaN across all properties');
  assert(!badHasInf, '9.2 Guarded against Infinity across all properties');

  // ----------------------------------------------------
  // SECTION 10: REAL DATA VERIFICATION (data/portfolio.json)
  // ----------------------------------------------------
  console.log('\n--- 10. Real Dataset Verification (data/portfolio.json) ---');
  const filePath = path.join(process.cwd(), 'data', 'portfolio.json');
  const realRaw = fs.readFileSync(filePath, 'utf-8');
  const realHoldings: PortfolioHolding[] = JSON.parse(realRaw);

  assert(realHoldings.length === 26, '10.1 Real dataset contains exactly 26 active holdings');

  // Verify all real holdings have null market data
  const allRealCmpNull = realHoldings.every((h) => h.cmp === null && h.peRatio === null && h.latestEarnings === null);
  assert(allRealCmpNull, '10.2 Real dataset preserves CMP, P/E, Latest Earnings as strictly null');

  const realHydrated = hydratePortfolio(realHoldings);
  const realSummary = calculatePortfolioSummary(realHoldings);

  assert(realSummary.totalInvestment === 1543060, '10.3 Total Investment matches Excel benchmark (₹15,43,060)');
  assert(realSummary.dataState === 'SOURCE_ONLY', '10.4 Real dataset dataState is SOURCE_ONLY');
  assert(realSummary.totalPresentValue === null, '10.5 Real dataset totalPresentValue is strictly null');
  assert(realSummary.totalGainLoss === null, '10.6 Real dataset totalGainLoss is strictly null');
  assert(realSummary.marketDataCoverage === 0, '10.7 Real dataset marketDataCoverage is 0%');

  // Verify exact sector totals from Excel workbook
  const realSectorSummaries = calculateSectorSummaries(realHydrated);
  const expectedSectorBenchmarks: Record<string, { count: number; inv: number }> = {
    'Financial Sector': { count: 5, inv: 328450 },
    'Tech Sector': { count: 6, inv: 337820 },
    'Consumer': { count: 3, inv: 263565 },
    'Power': { count: 4, inv: 158860 },
    'Pipe Sector': { count: 3, inv: 198656 },
    'Others': { count: 5, inv: 255709 },
  };

  let realSectorsPassed = true;
  for (const [sName, expected] of Object.entries(expectedSectorBenchmarks)) {
    const found = realSectorSummaries.find((s) => s.sector === sName);
    if (!found || found.holdingsCount !== expected.count || found.totalInvestment !== expected.inv) {
      realSectorsPassed = false;
      console.error(`Sector mismatch for ${sName}:`, { found, expected });
    }
  }
  assert(realSectorsPassed, '10.8 All 6 sectors match exact Excel investment totals and holding counts');

  const realSectorInvSum = realSectorSummaries.reduce((sum, s) => sum + s.totalInvestment, 0);
  assert(realSectorInvSum === 1543060, '10.9 Sum of sector investments equals ₹15,43,060');

  const realWeightSum = realSectorSummaries.reduce((sum, s) => sum + s.portfolioWeight, 0);
  assert(Math.abs(realWeightSum - 100) < 0.0001, '10.10 Sum of sector portfolio weights equals 100%');

  const individualWeightsSum = realHydrated.reduce((sum, h) => sum + (h.portfolioWeight ?? 0), 0);
  assert(Math.abs(individualWeightsSum - 100) < 0.0001, '10.11 Sum of holding portfolio weights equals 100%');

  console.log('\n----------------------------------------------------');
  console.log(`Phase 3 Test Results: ${passedTests} / ${totalTests} assertions passed.`);
  console.log('----------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();

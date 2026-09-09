import fs from 'fs';
import path from 'path';
import { PortfolioHolding } from '../types/portfolio';
import {
  toYahooSymbol,
} from '../lib/portfolio/normalization';
import { validatePortfolio, validateHolding } from '../lib/portfolio/validation';
import { hydratePortfolio } from '../lib/portfolio/calculations';
import { calculateSectorSummaries } from '../lib/portfolio/grouping';

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

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 2 AUTOMATED TEST & VERIFICATION SUITE');
  console.log('====================================================\n');

  // Load data/portfolio.json
  const filePath = path.join(process.cwd(), 'data', 'portfolio.json');
  assert(fs.existsSync(filePath), '1. portfolio.json file exists on disk');

  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const holdings: PortfolioHolding[] = JSON.parse(rawContent);

  // Requirement 1: Excel rows are correctly identified
  assert(
    holdings.length === 26,
    '2. Exactly 26 active holdings extracted from Excel',
    `Found ${holdings.length}`
  );

  // Requirement 2: Sector headings are not treated as stocks
  const sectorNames = ['Financial Sector', 'Tech Sector', 'Consumer', 'Power', 'Pipe Sector', 'Others'];
  const hasSectorAsStock = holdings.some((h) =>
    sectorNames.some((s) => h.name.toLowerCase() === s.toLowerCase())
  );
  assert(!hasSectorAsStock, '3. Sector headings are not treated as stocks');

  // Requirement 3: Stock names are normalized
  const tanlaHolding = holdings.find((h) => h.name.includes('Tanla'));
  assert(
    tanlaHolding !== undefined && tanlaHolding.name === 'Tanla',
    '4. Stock names are trimmed and normalized (e.g. "Tanla " -> "Tanla")',
    `Tanla holding name: "${tanlaHolding?.name}"`
  );

  // Requirement 4: Purchase prices become numbers
  const allPricesAreNumbers = holdings.every(
    (h) => typeof h.purchasePrice === 'number' && !isNaN(h.purchasePrice) && h.purchasePrice > 0
  );
  assert(allPricesAreNumbers, '5. All purchase prices are valid positive numbers');

  // Requirement 5: Quantities become numbers
  const allQuantitiesAreNumbers = holdings.every(
    (h) => typeof h.quantity === 'number' && !isNaN(h.quantity) && h.quantity > 0 && Number.isInteger(h.quantity)
  );
  assert(allQuantitiesAreNumbers, '6. All quantities are valid positive integers');

  // Requirement 6: Empty values become null
  const marketValuesAreNull = holdings.every(
    (h) => h.cmp === null && h.peRatio === null && h.latestEarnings === null
  );
  assert(marketValuesAreNull, '7. Unfetched market values (CMP, P/E, Latest Earnings) are strictly null');

  // Requirement 7: Invalid numeric values are detected
  const testInvalidHolding: PortfolioHolding = {
    id: 'test-invalid',
    name: 'Invalid Test Stock',
    purchasePrice: NaN,
    quantity: -5,
    exchangeCode: '',
    sector: '',
  };
  const invalidResult = validateHolding(testInvalidHolding, 99);
  assert(
    invalidResult.errors.length >= 4,
    '8. Validation layer detects invalid numbers (NaN, negative qty, missing symbol, missing sector)',
    `Caught ${invalidResult.errors.length} errors: ${invalidResult.errors.join('; ')}`
  );

  // Requirement 8: Yahoo symbols can be derived from exchange information
  const hdfcYahoo = toYahooSymbol('HDFCBANK');
  const iciciYahoo = toYahooSymbol('532174');
  assert(
    hdfcYahoo === 'HDFCBANK.NS' && iciciYahoo === '532174.BO',
    '9. Yahoo symbols correctly derived for both NSE tickers (.NS) and BSE scrip codes (.BO)',
    `HDFC: ${hdfcYahoo}, ICICI: ${iciciYahoo}`
  );

  // Requirement 9 & 10: No NaN and No Infinity exists
  let hasNaN = false;
  let hasInfinity = false;
  for (const h of holdings) {
    for (const v of Object.values(h)) {
      if (typeof v === 'number') {
        if (isNaN(v)) hasNaN = true;
        if (!isFinite(v)) hasInfinity = true;
      }
    }
  }
  assert(!hasNaN, '10. Zero NaN values exist in normalized portfolio dataset');
  assert(!hasInfinity, '11. Zero Infinity values exist in normalized portfolio dataset');

  // Validation Layer Check on live dataset
  const datasetValidation = validatePortfolio(holdings);
  assert(datasetValidation.isValid, '12. Full dataset passes all domain validation checks without errors');

  // Benchmark Check: Total Investment matches Excel Row 35 (₹1,543,060)
  const hydrated = hydratePortfolio(holdings);
  const totalInvestment = hydrated.reduce((sum, h) => sum + (h.investment || 0), 0);
  assert(
    totalInvestment === 1543060,
    '13. Portfolio Total Investment matches Excel benchmark (₹15,43,060)',
    `Calculated: ₹${totalInvestment.toLocaleString('en-IN')}`
  );

  // Benchmark Check: Sector Breakdown matches Excel sector rows
  const sectorSummaries = calculateSectorSummaries(hydrated);
  const expectedSectors: Record<string, { count: number; inv: number }> = {
    'Financial Sector': { count: 5, inv: 328450 },
    'Tech Sector': { count: 6, inv: 337820 },
    'Consumer': { count: 3, inv: 263565 },
    'Power': { count: 4, inv: 158860 },
    'Pipe Sector': { count: 3, inv: 198656 },
    'Others': { count: 5, inv: 255709 },
  };

  let allSectorsMatch = true;
  for (const [sName, expected] of Object.entries(expectedSectors)) {
    const found = sectorSummaries.find((s) => s.sector === sName);
    if (!found || found.holdingsCount !== expected.count || found.totalInvestment !== expected.inv) {
      allSectorsMatch = false;
      console.error(`Mismatch for sector "${sName}":`, { found, expected });
    }
  }
  assert(allSectorsMatch, '14. Sector holdings count and investment sums match Excel sheet exactly');

  console.log('\n----------------------------------------------------');
  console.log(`Results: ${passedTests} / ${totalTests} assertions passed.`);
  console.log('----------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});

import assert from 'node:assert';
import { validateMarketPrice } from '../lib/finance/marketValidation';
import { hydratePortfolio, calculatePortfolioSummary } from '../lib/portfolio/calculations';
import { calculateSectorSummaries } from '../lib/portfolio/grouping';
import { PortfolioHolding } from '../types/portfolio';
import rawPortfolioData from '../data/portfolio.json';

console.log('====================================================');
console.log('REGRESSION SUITE: LIVE MARKET DATA SANITY & VALIDATION');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. Core Validation Rule Checks (Item 10)
// ----------------------------------------------------
console.log('--- 1. Validation Edge Case Tests ---');

// 1.1 Normal CMP
const normalRes = validateMarketPrice(1500, { purchasePrice: 1490 });
assert.strictEqual(normalRes.isValid, true, '1.1 Normal CMP is valid');
assert.strictEqual(normalRes.sanitizedCmp, 1500, '1.1 Returns original CMP when valid');

// 1.2 Zero CMP
const zeroRes = validateMarketPrice(0, { purchasePrice: 100 });
assert.strictEqual(zeroRes.isValid, false, '1.2 Zero CMP rejected');
assert.strictEqual(zeroRes.sanitizedCmp, null, '1.2 Zero CMP returns sanitized null');

// 1.3 Negative CMP
const negRes = validateMarketPrice(-50, { purchasePrice: 100 });
assert.strictEqual(negRes.isValid, false, '1.3 Negative CMP rejected');
assert.strictEqual(negRes.sanitizedCmp, null, '1.3 Negative CMP returns sanitized null');

// 1.4 NaN
const nanRes = validateMarketPrice(NaN, { purchasePrice: 100 });
assert.strictEqual(nanRes.isValid, false, '1.4 NaN CMP rejected');
assert.strictEqual(nanRes.sanitizedCmp, null, '1.4 NaN CMP returns sanitized null');

// 1.5 Infinity and -Infinity
const infRes = validateMarketPrice(Infinity, { purchasePrice: 100 });
assert.strictEqual(infRes.isValid, false, '1.5 Infinity CMP rejected');
assert.strictEqual(infRes.sanitizedCmp, null, '1.5 Infinity CMP returns sanitized null');

const negInfRes = validateMarketPrice(-Infinity, { purchasePrice: 100 });
assert.strictEqual(negInfRes.isValid, false, '1.5.2 -Infinity CMP rejected');
assert.strictEqual(negInfRes.sanitizedCmp, null, '1.5.2 -Infinity CMP returns sanitized null');

// 1.6 Extremely Large CMP (exceeding maximum absolute share price)
const hugeRes = validateMarketPrice(10_603_328_500, { purchasePrice: 4284 });
assert.strictEqual(hugeRes.isValid, false, '1.6 Absurd ₹10.6 billion CMP rejected');
assert.strictEqual(hugeRes.sanitizedCmp, null, '1.6 Absurd CMP returns sanitized null');

// 1.7 Implausible CMP relative to purchase price (> 50x)
const spikeRes = validateMarketPrice(6000, { purchasePrice: 100 }); // 60x gain
assert.strictEqual(spikeRes.isValid, false, '1.7 60x spike over purchase price rejected');
assert.strictEqual(spikeRes.sanitizedCmp, null, '1.7 Spike returns sanitized null');

// 1.8 Legitimate high-priced stock (e.g., MRF at ~₹1,40,000)
const mrfRes = validateMarketPrice(140_000, { purchasePrice: 85_000 });
assert.strictEqual(mrfRes.isValid, true, '1.8 Legitimate high-priced stock (~₹1.4L) is accepted');
assert.strictEqual(mrfRes.sanitizedCmp, 140_000, '1.8 Legitimate high-priced stock retains value');

// 1.9 Null and Undefined CMP
const nullRes = validateMarketPrice(null, { purchasePrice: 100 });
assert.strictEqual(nullRes.isValid, true, '1.9 Null CMP is accepted as pending data');
assert.strictEqual(nullRes.sanitizedCmp, null, '1.9 Null CMP remains null');

const undefRes = validateMarketPrice(undefined, { purchasePrice: 100 });
assert.strictEqual(undefRes.isValid, true, '1.9.2 Undefined CMP is accepted as pending data');
assert.strictEqual(undefRes.sanitizedCmp, null, '1.9.2 Undefined CMP remains null');

console.log('✓ [PASS] 1.1 - 1.9 All 9 unit validation cases passed cleanly');

// ----------------------------------------------------
// 2. Fine Organic Specific Regression Test (Items 11, 12)
// ----------------------------------------------------
console.log('\n--- 2. Fine Organic Regression & Portfolio Insulation ---');

const rawHoldings = rawPortfolioData as PortfolioHolding[];
const fineHolding = rawHoldings.find((h) => h.exchangeCode === '541557');
assert(fineHolding, 'Fine Organic holding exists in portfolio');
assert.strictEqual(fineHolding.purchasePrice, 4284, 'Fine Organic purchase price is ₹4,284');
assert.strictEqual(fineHolding.quantity, 16, 'Fine Organic quantity is 16');

// Simulate the corrupt Yahoo response
const corruptYahooCmp = 10_603_328_500;
const fineValidation = validateMarketPrice(corruptYahooCmp, {
  purchasePrice: fineHolding.purchasePrice,
  fiftyTwoWeekHigh: 7326.45,
});

assert.strictEqual(fineValidation.isValid, false, '2.1 Corrupt Fine Organic CMP is rejected');
assert.strictEqual(fineValidation.sanitizedCmp, null, '2.2 Corrupt Fine Organic CMP is sanitized to null');

// Create mock portfolio where Fine Organic has corrupt CMP and others have valid prices
const mockMerged: PortfolioHolding[] = rawHoldings.map((h) => {
  if (h.exchangeCode === '541557') {
    // Inject corrupt CMP directly into holding
    return {
      ...h,
      cmp: corruptYahooCmp,
    };
  }
  if (h.exchangeCode === 'HDFCBANK') {
    return { ...h, cmp: 1650 };
  }
  if (h.exchangeCode === 'BAJFINANCE') {
    return { ...h, cmp: 6800 };
  }
  return { ...h };
});

// Hydrate portfolio through calculation engine
const hydrated = hydratePortfolio(mockMerged);
const hydratedFine = hydrated.find((h) => h.exchangeCode === '541557');

assert(hydratedFine, 'Hydrated Fine Organic exists');
assert.strictEqual(hydratedFine.cmp, null, '2.3 Hydrated Fine Organic CMP is sanitized to null');
assert.strictEqual(hydratedFine.presentValue, null, '2.4 Fine Organic present value is null (NOT ₹1,69,65,32,56,000)');
assert.strictEqual(hydratedFine.gainLoss, null, '2.5 Fine Organic gain/loss is null');
assert.strictEqual(hydratedFine.gainLossPercentage, null, '2.6 Fine Organic return % is null');

// Reconcile portfolio summary
const summary = calculatePortfolioSummary(hydrated);
assert(
  summary.totalPresentValue !== null && summary.totalPresentValue < 100_000_000,
  `2.7 Portfolio Present Value (${summary.totalPresentValue}) remains sane (far below ₹1.69 lakh crore)`
);
assert(
  summary.totalGainLoss !== null && Math.abs(summary.totalGainLoss) < 100_000_000,
  `2.8 Portfolio Gain/Loss (${summary.totalGainLoss}) remains sane`
);
assert(
  summary.totalGainLossPercentage !== null && summary.totalGainLossPercentage < 100,
  `2.9 Portfolio Overall Return (${summary.totalGainLossPercentage?.toFixed(2)}%) remains sane (far below +33236960%)`
);

// Reconcile sector summaries
const sectorSummaries = calculateSectorSummaries(hydrated);
const othersSector = sectorSummaries.find((s) => s.sector === 'Others');
assert(othersSector, 'Others sector exists');
assert.strictEqual(
  othersSector.totalPresentValue,
  null,
  '2.10 Sector Present Value is null when active holdings in sector have null CMP'
);
assert.strictEqual(
  othersSector.totalGainLoss,
  null,
  '2.11 Sector Gain/Loss is null when active holdings in sector have null CMP'
);

console.log('✓ [PASS] 2.1 - 2.11 Fine Organic regression prevented catastrophic portfolio valuation');

// ----------------------------------------------------
// 3. Legitimate Market Data Preservation (Item 8)
// ----------------------------------------------------
console.log('\n--- 3. Legitimate Market Data Preservation ---');
const legitimateTestCases = [
  { name: 'HDFC Bank', code: 'HDFCBANK', purchasePrice: 1490, cmp: 691.1 },
  { name: 'Bajaj Finance', code: 'BAJFINANCE', purchasePrice: 6466, cmp: 1042.0 },
  { name: 'Affle India', code: 'AFFLE', purchasePrice: 1151, cmp: 1588.8 },
  { name: 'Dmart', code: 'DMART', purchasePrice: 3777, cmp: 3730.0 },
  { name: 'Astral', code: 'ASTRAL', purchasePrice: 1517, cmp: 1472.6 },
  { name: 'Savani Financials', code: '511577', purchasePrice: 24, cmp: 21.75 },
];

for (const stock of legitimateTestCases) {
  const res = validateMarketPrice(stock.cmp, { purchasePrice: stock.purchasePrice });
  assert.strictEqual(res.isValid, true, `3. ${stock.name} (${stock.code}) CMP ₹${stock.cmp} is valid`);
  assert.strictEqual(res.sanitizedCmp, stock.cmp, `3. ${stock.name} retains exact CMP ₹${stock.cmp}`);
}
console.log('✓ [PASS] All 6 legitimate portfolio stocks preserved without false positives');

console.log('\n----------------------------------------------------');
console.log('Market Validation Regression Suite: ALL CHECKS PASSED.');
console.log('----------------------------------------------------');

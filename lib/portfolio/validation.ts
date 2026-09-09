import { PortfolioHolding, PortfolioValidationResult } from '@/types/portfolio';

/**
 * Validates a single portfolio holding record.
 * Returns a list of error messages (if any) and warnings.
 */
export function validateHolding(
  holding: PortfolioHolding,
  index: number
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recordLabel = holding.name ? `Holding "${holding.name}" (#${index + 1})` : `Holding #${index + 1}`;

  // 1. Stock Name Validation
  if (!holding.name || holding.name.trim() === '') {
    errors.push(`${recordLabel}: Missing stock name.`);
  }

  // 2. Purchase Price Validation
  if (holding.purchasePrice == null || typeof holding.purchasePrice !== 'number') {
    errors.push(`${recordLabel}: Purchase price must be a valid number.`);
  } else if (isNaN(holding.purchasePrice)) {
    errors.push(`${recordLabel}: Purchase price cannot be NaN.`);
  } else if (!isFinite(holding.purchasePrice)) {
    errors.push(`${recordLabel}: Purchase price cannot be Infinity.`);
  } else if (holding.purchasePrice <= 0) {
    errors.push(`${recordLabel}: Purchase price must be greater than zero (received ${holding.purchasePrice}).`);
  }

  // 3. Quantity Validation
  if (holding.quantity == null || typeof holding.quantity !== 'number') {
    errors.push(`${recordLabel}: Quantity must be a valid number.`);
  } else if (isNaN(holding.quantity)) {
    errors.push(`${recordLabel}: Quantity cannot be NaN.`);
  } else if (!isFinite(holding.quantity)) {
    errors.push(`${recordLabel}: Quantity cannot be Infinity.`);
  } else if (holding.quantity <= 0) {
    errors.push(`${recordLabel}: Quantity must be greater than zero (received ${holding.quantity}).`);
  } else if (!Number.isInteger(holding.quantity)) {
    warnings.push(`${recordLabel}: Quantity has fractional shares (${holding.quantity}).`);
  }

  // 4. Exchange Code Validation
  if (!holding.exchangeCode || holding.exchangeCode.trim() === '') {
    errors.push(`${recordLabel}: Missing exchange symbol/code.`);
  }

  // 5. Sector Validation
  if (!holding.sector || holding.sector.trim() === '' || holding.sector === 'Unclassified') {
    errors.push(`${recordLabel}: Missing or unclassified sector.`);
  }

  // 6. Safeguards against NaN or Infinity in optional numeric fields
  const optionalNumericFields: (keyof PortfolioHolding)[] = [
    'investment',
    'portfolioWeight',
    'presentValue',
    'gainLoss',
    'gainLossPercentage',
    'cmp',
    'peRatio',
  ];

  for (const field of optionalNumericFields) {
    const val = holding[field];
    if (typeof val === 'number') {
      if (isNaN(val)) {
        errors.push(`${recordLabel}: Field "${field}" contains NaN.`);
      }
      if (!isFinite(val)) {
        errors.push(`${recordLabel}: Field "${field}" contains Infinity.`);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validates an entire collection of portfolio holdings.
 */
export function validatePortfolio(holdings: PortfolioHolding[]): PortfolioValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  if (!Array.isArray(holdings) || holdings.length === 0) {
    return {
      isValid: false,
      errors: ['Portfolio contains no holdings or is not an array.'],
      warnings: [],
      totalChecked: 0,
    };
  }

  holdings.forEach((holding, idx) => {
    const { errors, warnings } = validateHolding(holding, idx);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    totalChecked: holdings.length,
  };
}

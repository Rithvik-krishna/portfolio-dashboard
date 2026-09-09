/**
 * Centralized Financial Number and Time Formatters
 *
 * Implements standard Indian financial notation (e.g. ₹15,43,060),
 * percentage formatting with explicit positive/negative signs,
 * and null-safe fallbacks displaying 'N/A' for unavailable metrics.
 */

/**
 * Formats numeric monetary value into Indian Rupee currency format (₹).
 * Returns 'N/A' if value is null, undefined, or not a finite number.
 */
export function formatCurrency(
  value: number | null | undefined,
  options?: {
    showDecimals?: boolean;
    includeSign?: boolean;
  }
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  const { showDecimals = false, includeSign = false } = options || {};

  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString('en-IN', {
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0,
  });

  const sign = value > 0 && includeSign ? '+' : value < 0 ? '-' : '';
  return `${sign}₹${formatted}`;
}

/**
 * Formats a decimal/percentage number into standard percentage string (e.g. +3.13%, -1.45%).
 * Returns 'N/A' if value is null, undefined, or not a finite number.
 */
export function formatPercentage(
  value: number | null | undefined,
  options?: {
    decimals?: number;
    includeSign?: boolean;
  }
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  const { decimals = 2, includeSign = true } = options || {};
  const sign = value > 0 && includeSign ? '+' : value < 0 && includeSign ? '-' : '';
  const absValue = Math.abs(value);
  return `${sign}${absValue.toFixed(decimals)}%`;
}

/**
 * Formats standard numeric quantity or ratio (e.g. P/E ratio, Quantity).
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return value.toLocaleString('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

/**
 * Formats numbers into compact Indian financial denominations (e.g. 15.43L, 1.25Cr).
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 10000000) {
    return `${sign}₹${(absValue / 10000000).toFixed(2)} Cr`;
  }
  if (absValue >= 100000) {
    return `${sign}₹${(absValue / 100000).toFixed(2)} L`;
  }
  if (absValue >= 1000) {
    return `${sign}₹${(absValue / 1000).toFixed(1)}k`;
  }

  return `${sign}₹${absValue.toFixed(0)}`;
}

/**
 * Formats ISO timestamp into friendly relative time (e.g. 'just now', '12s ago', '2m ago').
 */
export function formatRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
}

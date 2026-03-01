export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format a USD amount for display, choosing decimal places based on magnitude.
 * - >= $1:    2 decimals  ($1.23)
 * - >= $0.01: 4 decimals  ($0.0012)
 * - < $0.01:  6 decimals  ($0.000123)
 */
export function formatUsd(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(6)}`;
}

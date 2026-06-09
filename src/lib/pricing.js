// ============================================================
// Premium pricing — per-locale lifetime price + currency symbol.
//
// One-time payment, not subscription. Amounts are tuned per region
// (₪20 ≈ $5 ≈ €5) so the perceived value is similar everywhere.
// When a real payment provider gets wired, this is the single
// source of truth for what to charge — providers' product/price
// objects should mirror it 1:1.
// ============================================================

export const PRICING = {
  he: { amount: 20,   symbol: '₪', placement: 'prefix' },
  ar: { amount: 20,   symbol: '₪', placement: 'prefix' },
  en: { amount: 7,    symbol: '$', placement: 'prefix' },
  es: { amount: 7,    symbol: '€', placement: 'suffix' },
  fr: { amount: 7,    symbol: '€', placement: 'suffix' },
  de: { amount: 7,    symbol: '€', placement: 'suffix' },
  pt: { amount: 7,    symbol: '€', placement: 'suffix' },
  it: { amount: 7,    symbol: '€', placement: 'suffix' },
  ru: { amount: 650,  symbol: '₽', placement: 'suffix' },
  tr: { amount: 250,  symbol: '₺', placement: 'prefix' },
  hi: { amount: 600,  symbol: '₹', placement: 'prefix' },
  zh: { amount: 50,   symbol: '¥', placement: 'prefix' },
  ja: { amount: 1100, symbol: '¥', placement: 'prefix' },
  ko: { amount: 9500, symbol: '₩', placement: 'prefix' },
};

const FALLBACK = { amount: 7, symbol: '$', placement: 'prefix' };

/** Return the pricing entry for a locale; falls back to USD when unknown. */
export function getPricing(lang) {
  return PRICING[lang] || FALLBACK;
}

/** Format a number using the locale's symbol/placement. Trims `.00` for
    integer amounts. Override `amount` to render a different number with
    the same locale's symbol — useful for discounted prices. */
export function formatPrice(lang, amountOverride) {
  const p = getPricing(lang);
  const amount = amountOverride ?? p.amount;
  const value = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
  return p.placement === 'prefix' ? `${p.symbol}${value}` : `${value}${p.symbol}`;
}

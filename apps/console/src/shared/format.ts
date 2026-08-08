// Formatting shared across features. Money and dates are carried as minor units
// and ISO strings respectively (ADR-0012, convention 2); this is where they
// become something a person reads.

/**
 * `minor` is an integer in the currency's smallest unit — 120000 UAH minor is
 * ₴1,200.00. Never a float: 0.1 + 0.2 is not 0.3, and this product bills real
 * money.
 */
export function formatMoney(minor: number, currency: string, locale = "uk-UA"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

/** ISO 8601 in, short readable date out. */
export function formatDate(iso: string, locale = "uk-UA"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

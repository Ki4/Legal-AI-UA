// Formatting shared across features. Money and dates are carried as minor units
// and ISO strings respectively (ADR-0012, convention 2); this is where they
// become something a person reads.
//
// Both helpers are total: bad data produces visibly odd text, never a thrown
// exception. There is no ErrorBoundary in the console yet, so a throw from a
// formatter would replace a whole screen with a generic error page — a far
// worse outcome than one wrong-looking cell.

/**
 * `minor` is an integer in the currency's smallest unit. Never a float: 0.1 +
 * 0.2 is not 0.3, and this product bills real money.
 *
 * The divisor comes from the currency rather than being hardcoded to 100 —
 * JPY has no minor unit and KWD has three, so a fixed 100 would render those
 * 100× low and 10× high respectively, silently, on a billing surface.
 */
export function formatMoney(minor: number, currency: string, locale = "uk-UA"): string {
  try {
    const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(minor / 10 ** exponent);
  } catch {
    // An unknown or malformed currency code makes Intl throw. Show the raw
    // figures so the bad data is visible rather than fatal.
    return `${minor} ${currency}`;
  }
}

/** ISO 8601 in, short readable date out. Unparsable input is returned as-is. */
export function formatDate(iso: string, locale = "uk-UA"): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed);
}

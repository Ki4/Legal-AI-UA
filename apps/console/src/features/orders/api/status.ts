// Narrowing a state that arrives as loose text, in its own file because both
// implementations need it and neither may reach the other: the fixture one must
// not import the Supabase one, which builds a client at import time.

import { ORDER_STATUSES, type OrderStatus } from "@legal-ai/db";

/**
 * The state an event left the order in, or null when it left it alone.
 *
 * The audit log stores payloads as `jsonb`, so what comes back is a `string`
 * until something checks it — and an unrecognised value becomes null rather
 * than being cast through. A status added in a migration and missed in
 * `ORDER_STATUSES` then disappears from the timeline while still rendering on
 * the card, which is visibly odd and therefore findable (DoD §5).
 */
export function toStatusAfter(value: unknown): OrderStatus | null {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as OrderStatus)
    : null;
}

// Which tone a state wears, and the reasoning for each — because a colour on
// this screen is a claim about whether somebody needs to do something.
//
// A `Record<OrderStatus, BadgeTone>` rather than a function with a `default`,
// for the reason `shared/vocabulary.ts` gives about its own maps: a state added
// to `order_status` in a migration then fails to compile here until somebody
// has decided what it looks like. A `default` would quietly paint it neutral,
// which is the one answer that is never wrong enough to notice.

import type { OrderStatus } from "@legal-ai/db";
import type { BadgeTone } from "@legal-ai/ui";

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  // Nothing is owed by the firm yet — the client is still answering.
  intake: "neutral",
  submitted: "neutral",
  generating: "neutral",
  // The one state that is somebody's turn. ADR-0005 makes this the gate a
  // lawyer_required document cannot be delivered around, so it is the state a
  // queue is read to find.
  in_review: "warn",
  delivered: "ok",
  // Ended without a document, and deliberately not `danger`: a cancelled order
  // is an ordinary outcome, not a fault. `danger` here would paint a client
  // changing their mind as an incident.
  cancelled: "neutral",
  abandoned: "neutral",
};

export function statusTone(status: OrderStatus): BadgeTone {
  return ORDER_STATUS_TONE[status];
}

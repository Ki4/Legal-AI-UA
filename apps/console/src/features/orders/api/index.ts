// The swap point. One line picks the implementation (ADR-0012).
//
// Live from the first commit, like the service history and unlike the
// catalogue. The reasoning is the same and the conclusion is the opposite of
// what an empty table suggests: `orders` has no writer yet (ADM-5 is the
// gateway), so the honest thing for this screen to show today is an empty list
// — and a fixture implementation would show four invented orders instead,
// which is a screen nobody could tell from a working one.
//
// `orders.mock.ts` stays. It is what the contract tests run against — the
// sorting, the paging and the three reviewer states are assertable without a
// database — and it remains the shape any new implementation is checked
// against.

import type { OrdersApi } from "./contract";
import { supabaseOrdersApi } from "./orders.supabase";

export const ordersApi: OrdersApi = supabaseOrdersApi;

export type { OrdersApi } from "./contract";
export type {
  OrderCard,
  OrderEntitlement,
  OrderEvent,
  OrderListItem,
  OrderReviewer,
  OrdersPage,
  PinnedVersion,
} from "./types";

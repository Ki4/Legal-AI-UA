import type { RouteObject } from "react-router";
import { RequireAuth } from "../../app/RequireAuth";
import { OrderCardPage } from "./components/OrderCardPage";
import { OrdersListPage } from "./components/OrdersListPage";

// Both staff roles, and the guard is presentation rather than protection: what
// actually decides which orders a reader gets is `orders_select_staff`
// (DoD §7). The guard is here so that a reader with no role meets a sentence
// instead of an empty table — which on this screen would be indistinguishable
// from the ordinary empty state, since nothing writes orders yet.
export const ordersRoutes: RouteObject[] = [
  {
    path: "/orders",
    element: (
      <RequireAuth roles={["admin", "lawyer"]}>
        <OrdersListPage />
      </RequireAuth>
    ),
  },
  {
    path: "/orders/:orderId",
    element: (
      <RequireAuth roles={["admin", "lawyer"]}>
        <OrderCardPage />
      </RequireAuth>
    ),
  },
];

import type { RouteObject } from "react-router";
import { RequireAuth } from "../../app/RequireAuth";
import { ServiceHistoryPage } from "./components/ServiceHistoryPage";

// Both staff roles, and the guard is presentation rather than protection: what
// actually decides who reads what is `audit_events_select_admin` and
// `audit_events_select_assigned_lawyer` (DoD §7). The guard is here so that a
// reader with no role meets a sentence instead of an empty table.
export const serviceHistoryRoutes: RouteObject[] = [
  {
    path: "/services/:serviceId/history",
    element: (
      <RequireAuth roles={["admin", "lawyer"]}>
        <ServiceHistoryPage />
      </RequireAuth>
    ),
  },
];

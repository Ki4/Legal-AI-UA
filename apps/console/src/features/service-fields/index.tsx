import type { RouteObject } from "react-router";
import { RequireAuth } from "../../app/RequireAuth";
import { ServiceFieldsPage } from "./components/ServiceFieldsPage";

// Nested under `/services/:serviceId`, the precedent being `service-history` and
// `law`. Both staff roles, and the guard is presentation rather than protection:
// what decides who reads this is `questionnaire_fields_select_staff`, and what
// decides who writes is the admin arm plus the assigned-lawyer arm of the write
// policies (DoD §7). The guard is here so a reader with no role meets a sentence
// instead of an empty table.
export const serviceFieldsRoutes: RouteObject[] = [
  {
    path: "/services/:serviceId/fields",
    element: (
      <RequireAuth roles={["admin", "lawyer"]}>
        <ServiceFieldsPage />
      </RequireAuth>
    ),
  },
];

import type { RouteObject } from "react-router";
import { RequireAuth } from "../../app/RequireAuth";
import { LawRegisterPage } from "./components/LawRegisterPage";
import { ServiceLawPage } from "./components/ServiceLawPage";

// Two routes in one feature, because both read the same two tables and features
// may not import from each other. `service-history` is the precedent for a
// feature owning a path nested under `/services/:id`.
//
// Both staff roles, and the guard is presentation rather than protection: what
// decides who reads what is `law_norms_select_staff` and
// `service_law_refs_select_staff`, and what decides who *writes* is the
// assignment arm of the write policies (DoD §7). The guard is here so a reader
// with no role meets a sentence instead of an empty table.
export const lawRoutes: RouteObject[] = [
  {
    path: "/law",
    element: (
      <RequireAuth roles={["admin", "lawyer"]}>
        <LawRegisterPage />
      </RequireAuth>
    ),
  },
  {
    path: "/services/:serviceId/law",
    element: (
      <RequireAuth roles={["admin", "lawyer"]}>
        <ServiceLawPage />
      </RequireAuth>
    ),
  },
];

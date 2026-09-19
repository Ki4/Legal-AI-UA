import type { RouteObject } from "react-router";
import { RequireAuth } from "../../app/RequireAuth";
import { ServiceVersionsPage } from "./components/ServiceVersionsPage";

// Nested under `/services/:serviceId`, beside `fields`, `history` and `law`.
// Both staff roles read it; what each may *do* on it is decided per row by
// `availableActions` and enforced by the schema (DoD §7). The guard is here so
// a reader with no role meets a sentence instead of an empty table.
export const serviceVersionsRoutes: RouteObject[] = [
  {
    path: "/services/:serviceId/versions",
    element: (
      <RequireAuth roles={["admin", "lawyer"]}>
        <ServiceVersionsPage />
      </RequireAuth>
    ),
  },
];

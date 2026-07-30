import type { RouteObject } from "react-router";
import { RequireAuth } from "../../app/RequireAuth";
import { TeamPage } from "./components/TeamPage";

export const teamRoutes: RouteObject[] = [
  {
    path: "/team",
    element: (
      <RequireAuth roles={["admin"]}>
        <TeamPage />
      </RequireAuth>
    ),
  },
];

import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { accountRoutes } from "../features/account";
import { anatomyRoutes } from "../features/anatomy";
import { ordersRoutes } from "../features/orders";
import { designKitRoutes } from "../features/design-kit";
import { lawRoutes } from "../features/law";
import { serviceDetailRoutes } from "../features/service-detail";
import { serviceFieldsRoutes } from "../features/service-fields";
import { serviceHistoryRoutes } from "../features/service-history";
import { servicesRoutes } from "../features/services";
import { teamRoutes } from "../features/team";
import { AppShell } from "./AppShell";
import { NotFound } from "./NotFound";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { RequireAuth } from "./RequireAuth";

// This route table is the ONLY shared file between parallel feature tracks.
// Each feature contributes exactly one import and one spread line — nothing else.
//
// The table is exported apart from the router so that `routes.test.tsx` can
// walk every path in it under a memory router: a route added here is walked
// without anybody adding it to a list of routes to walk.
export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/services" replace /> },
      ...servicesRoutes,
      ...serviceDetailRoutes,
      ...serviceFieldsRoutes,
      ...serviceHistoryRoutes,
      ...ordersRoutes,
      ...lawRoutes,
      ...anatomyRoutes,
      ...accountRoutes,
      ...teamRoutes,
      ...designKitRoutes,
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);

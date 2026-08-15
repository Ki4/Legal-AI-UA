import { createBrowserRouter, Navigate } from "react-router";
import { accountRoutes } from "../features/account";
import { anatomyRoutes } from "../features/anatomy";
import { ordersRoutes } from "../features/orders";
import { designKitRoutes } from "../features/design-kit";
import { serviceDetailRoutes } from "../features/service-detail";
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
export const router = createBrowserRouter([
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
      ...serviceHistoryRoutes,
      ...ordersRoutes,
      ...anatomyRoutes,
      ...accountRoutes,
      ...teamRoutes,
      ...designKitRoutes,
      { path: "*", element: <NotFound /> },
    ],
  },
]);

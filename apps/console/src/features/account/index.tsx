import type { RouteObject } from "react-router";
import { AccountPage } from "./components/AccountPage";

export const accountRoutes: RouteObject[] = [{ path: "/account", element: <AccountPage /> }];

import type { RouteObject } from "react-router";
import { ServicesListPage } from "./components/ServicesListPage";

export const servicesRoutes: RouteObject[] = [{ path: "/services", element: <ServicesListPage /> }];

import type { RouteObject } from "react-router";
import { ServiceDetailPage } from "./components/ServiceDetailPage";

export const serviceDetailRoutes: RouteObject[] = [
  { path: "/services/:serviceId", element: <ServiceDetailPage /> },
];

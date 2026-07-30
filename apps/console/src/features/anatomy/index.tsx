import type { RouteObject } from "react-router";
import { AnatomyPage } from "./components/AnatomyPage";

export const anatomyRoutes: RouteObject[] = [
  { path: "/services/:serviceId/anatomy", element: <AnatomyPage /> },
];

import type { RouteObject } from "react-router";
import { DesignKitPage } from "./components/DesignKitPage";

export const designKitRoutes: RouteObject[] = [{ path: "/design", element: <DesignKitPage /> }];

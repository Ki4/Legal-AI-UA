import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AuthProvider } from "./app/auth";
import { router } from "./app/routes";
import { initTheme } from "./app/ThemeToggle";
import "./styles.css";

// Set data-theme before the first paint so the initial render already matches
// the persisted theme — no flash of the wrong theme.
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);

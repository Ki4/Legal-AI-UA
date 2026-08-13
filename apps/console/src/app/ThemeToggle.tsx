import { useI18n } from "@legal-ai/i18n";
import { Button } from "@legal-ai/ui";
import { useEffect, useState } from "react";

const STORAGE_KEY = "theme";

/** Reads persisted theme without touching the DOM — used both here and by the
 * pre-paint init in main.tsx so the two stay in sync. */
function getStoredTheme(): "dark" | "light" {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

/** Applies the theme to <html data-theme> before first paint, avoiding a flash
 * of the wrong theme. Call once, synchronously, from main.tsx's module scope. */
export function initTheme() {
  document.documentElement.setAttribute("data-theme", getStoredTheme());
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => getStoredTheme() === "dark");
  const { t } = useI18n();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  return (
    <Button variant="secondary" className="w-full" onClick={() => setDark((current) => !current)}>
      {dark ? t("theme.toLight") : t("theme.toDark")}
    </Button>
  );
}

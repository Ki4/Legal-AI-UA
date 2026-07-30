import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="w-full rounded-md border border-line px-3 py-1.5 hover:bg-canvas"
    >
      {dark ? "Light theme" : "Dark theme"}
    </button>
  );
}

import { useI18n, type TranslationKey } from "@legal-ai/i18n";
import { Button } from "@legal-ai/ui";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "./auth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

// The nav carries keys, not labels: a label baked in here would be in whichever
// language the module was written in, permanently, whatever the reader chose.
const baseNav: { to: string; key: TranslationKey }[] = [
  { to: "/services", key: "nav.services" },
  { to: "/orders", key: "nav.orders" },
  { to: "/law", key: "nav.law" },
  { to: "/account", key: "nav.account" },
  { to: "/design", key: "nav.design" },
];

const adminNav: { to: string; key: TranslationKey }[] = [{ to: "/team", key: "nav.team" }];

export function AppShell() {
  const { session, role, signOut } = useAuth();
  const { t } = useI18n();
  const nav = role === "admin" ? [...baseNav, ...adminNav] : baseNav;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-paper p-4">
        <div className="mb-6 font-semibold">{t("app.name")}</div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-brand text-white" : "text-inkSoft hover:bg-canvas"
                }`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 text-sm text-inkSoft">
          <div className="truncate">{session?.user.email}</div>
          {/* The role name itself stays as the system holds it: `admin` and
              `lawyer` are values in the database and in the JWT, and a reader
              comparing the screen to a policy needs the same word in both. */}
          <div>{t("shell.role", { role: role ?? t("shell.roleNone") })}</div>
          <LanguageSwitcher />
          <ThemeToggle />
          <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
            {t("auth.signOut")}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto w-full max-w-[1100px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

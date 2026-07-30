import { NavLink, Outlet } from "react-router";
import { useAuth } from "./auth";
import { ThemeToggle } from "./ThemeToggle";

const baseNav = [
  { to: "/services", label: "Services" },
  { to: "/account", label: "Account" },
];

const adminNav = [{ to: "/team", label: "Team" }];

export function AppShell() {
  const { session, role, signOut } = useAuth();
  const nav = role === "admin" ? [...baseNav, ...adminNav] : baseNav;

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="flex w-56 flex-col border-r border-line bg-surface p-4">
        <div className="mb-6 font-semibold">Legal-AI-UA</div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-accent text-accent-fg" : "text-ink-muted hover:bg-canvas"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 text-sm text-ink-muted">
          <div className="truncate">{session?.user.email}</div>
          <div>role: {role ?? "none"}</div>
          <ThemeToggle />
          <button
            onClick={() => void signOut()}
            className="w-full rounded-md border border-line px-3 py-1.5 hover:bg-canvas"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}

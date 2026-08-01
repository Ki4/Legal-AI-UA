import { Button } from "@legal-ai/ui";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "./auth";
import { ThemeToggle } from "./ThemeToggle";

const baseNav = [
  { to: "/services", label: "Services" },
  { to: "/account", label: "Account" },
  { to: "/design", label: "Design" },
];

const adminNav = [{ to: "/team", label: "Team" }];

export function AppShell() {
  const { session, role, signOut } = useAuth();
  const nav = role === "admin" ? [...baseNav, ...adminNav] : baseNav;

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="flex w-56 flex-col border-r border-line bg-paper p-4">
        <div className="mb-6 font-semibold">Legal-AI-UA</div>
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
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 text-sm text-inkSoft">
          <div className="truncate">{session?.user.email}</div>
          <div>role: {role ?? "none"}</div>
          <ThemeToggle />
          <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <div className="mx-auto w-full max-w-[1100px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

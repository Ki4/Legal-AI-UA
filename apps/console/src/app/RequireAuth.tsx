import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth, type Role } from "./auth";
import { PendingApproval } from "./PendingApproval";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-inkSoft">Loading…</div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!role) {
    return <PendingApproval />;
  }

  if (roles && !roles.includes(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-inkSoft">
        Access denied — this section requires a different role.
      </div>
    );
  }

  return <>{children}</>;
}

import { useI18n } from "@legal-ai/i18n";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth, type Role } from "./auth";
import { PendingApproval } from "./PendingApproval";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { session, role, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-inkSoft">
        {t("common.loading")}
      </div>
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
        {t("auth.denied.body")}
      </div>
    );
  }

  return <>{children}</>;
}

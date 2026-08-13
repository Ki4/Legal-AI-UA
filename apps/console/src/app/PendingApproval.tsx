import { useI18n } from "@legal-ai/i18n";
import { Button } from "@legal-ai/ui";
import { useAuth } from "./auth";

export function PendingApproval() {
  const { session, signOut } = useAuth();
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-line bg-paper p-8 text-center shadow-card">
        <h1 className="text-xl font-semibold text-ink">{t("auth.pending.title")}</h1>
        <p className="text-sm text-inkSoft">{t("auth.pending.body")}</p>
        <p className="text-sm text-inkMute">{session?.user.email}</p>
        <p className="text-sm text-inkSoft">{t("auth.pending.reSignIn")}</p>
        <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
          {t("auth.signOut")}
        </Button>
      </div>
    </div>
  );
}

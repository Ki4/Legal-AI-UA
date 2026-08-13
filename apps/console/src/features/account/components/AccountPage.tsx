import { useI18n } from "@legal-ai/i18n";
import { useAuth } from "../../../app/auth";

export function AccountPage() {
  const { session, role } = useAuth();
  const { t } = useI18n();

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("account.title")}</h1>
      <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-paper p-4 text-sm">
        <dt className="text-inkSoft">{t("auth.email")}</dt>
        <dd>{session?.user.email}</dd>
        <dt className="text-inkSoft">{t("account.role")}</dt>
        {/* Role stays raw, same as AppShell: `admin` / `lawyer` are the words an
            RLS policy is written in, and a reader comparing screen to policy
            needs the same word in both. */}
        <dd>{role ?? t("account.roleNone")}</dd>
        <dt className="text-inkSoft">{t("account.userId")}</dt>
        <dd className="truncate">{session?.user.id}</dd>
      </dl>
    </section>
  );
}

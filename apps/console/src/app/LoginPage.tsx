import { useI18n, type TranslationKey } from "@legal-ai/i18n";
import { Button, FormField, Input } from "@legal-ai/ui";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { authErrorKey } from "./authErrors";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { supabase } from "./supabase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(authErrorKey(signInError.code, "auth.error.signInFailed"));
      return;
    }
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";
    navigate(from, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="fixed right-4 top-4 w-36">
        <LanguageSwitcher />
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-card border border-line bg-paper p-8 shadow-card"
      >
        <h1 className="text-xl font-semibold text-ink">{t("app.console")}</h1>
        <FormField htmlFor="login-email" label={t("auth.email")}>
          <Input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="login-password"
          label={t("auth.password")}
          error={error ? t(error) : undefined}
        >
          <Input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={Boolean(error)}
          />
        </FormField>
        <Button type="submit" variant="primary" loading={submitting} className="w-full">
          {submitting ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
        <p className="text-center text-sm text-inkSoft">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="text-ink hover:underline">
            {t("auth.register")}
          </Link>
        </p>
      </form>
    </div>
  );
}

import { useI18n } from "@legal-ai/i18n";
import { Button, FormField, Input } from "@legal-ai/ui";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { supabase } from "./supabase";

export function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      navigate("/", { replace: true });
      return;
    }
    setInfo(t("auth.confirmEmail"));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-card border border-line bg-paper p-8 shadow-card"
      >
        <h1 className="text-xl font-semibold text-ink">{t("app.console")}</h1>
        <FormField htmlFor="register-name" label={t("auth.fullName")}>
          <Input
            id="register-name"
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </FormField>
        <FormField htmlFor="register-email" label={t("auth.email")}>
          <Input
            id="register-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="register-password"
          label={t("auth.password")}
          error={error ?? undefined}
        >
          <Input
            id="register-password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={Boolean(error)}
          />
        </FormField>
        {info && <p className="text-sm text-inkSoft">{info}</p>}
        <Button type="submit" variant="primary" loading={submitting} className="w-full">
          {submitting ? t("auth.creatingAccount") : t("auth.register")}
        </Button>
        <p className="text-center text-sm text-inkSoft">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="text-ink hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </form>
    </div>
  );
}

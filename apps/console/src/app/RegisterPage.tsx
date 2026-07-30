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
    setInfo("Check your email to confirm your address, then sign in.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8"
      >
        <h1 className="text-xl font-semibold text-ink">Legal-AI-UA console</h1>
        <label className="block space-y-1">
          <span className="text-sm text-ink-muted">Full name</span>
          <input
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-ink-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-ink-muted">Password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        {info && <p className="text-sm text-ink-muted">{info}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent px-3 py-2 font-medium text-accent-fg disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Register"}
        </button>
        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-ink hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

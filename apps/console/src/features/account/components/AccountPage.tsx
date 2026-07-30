import { useAuth } from "../../../app/auth";

export function AccountPage() {
  const { session, role } = useAuth();

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
        <dt className="text-ink-muted">Email</dt>
        <dd>{session?.user.email}</dd>
        <dt className="text-ink-muted">Role</dt>
        <dd>{role ?? "not assigned"}</dd>
        <dt className="text-ink-muted">User id</dt>
        <dd className="truncate">{session?.user.id}</dd>
      </dl>
    </section>
  );
}

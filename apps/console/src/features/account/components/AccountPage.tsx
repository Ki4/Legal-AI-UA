import { useAuth } from "../../../app/auth";

export function AccountPage() {
  const { session, role } = useAuth();

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>
      <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-paper p-4 text-sm">
        <dt className="text-inkSoft">Email</dt>
        <dd>{session?.user.email}</dd>
        <dt className="text-inkSoft">Role</dt>
        <dd>{role ?? "not assigned"}</dd>
        <dt className="text-inkSoft">User id</dt>
        <dd className="truncate">{session?.user.id}</dd>
      </dl>
    </section>
  );
}

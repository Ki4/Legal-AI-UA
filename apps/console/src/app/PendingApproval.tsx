import { useAuth } from "./auth";

export function PendingApproval() {
  const { session, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold text-ink">Awaiting approval</h1>
        <p className="text-sm text-ink-muted">
          Your account has been created and is waiting for an administrator to approve it.
        </p>
        <p className="text-sm text-ink-muted">{session?.user.email}</p>
        <p className="text-sm text-ink-muted">
          After approval, sign out and sign in again — your role arrives with a fresh session.
        </p>
        <button
          onClick={() => void signOut()}
          className="w-full rounded-md border border-line px-3 py-2 text-ink hover:bg-canvas"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

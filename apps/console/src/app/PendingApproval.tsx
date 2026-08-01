import { Button } from "@legal-ai/ui";
import { useAuth } from "./auth";

export function PendingApproval() {
  const { session, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-line bg-paper p-8 text-center shadow-card">
        <h1 className="text-xl font-semibold text-ink">Awaiting approval</h1>
        <p className="text-sm text-inkSoft">
          Your account has been created and is waiting for an administrator to approve it.
        </p>
        <p className="text-sm text-inkMute">{session?.user.email}</p>
        <p className="text-sm text-inkSoft">
          After approval, sign out and sign in again — your role arrives with a fresh session.
        </p>
        <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

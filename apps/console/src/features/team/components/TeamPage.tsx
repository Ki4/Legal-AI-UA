import { useEffect, useState } from "react";
import { supabase } from "../../../app/supabase";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "lawyer" | null;
  created_at: string;
}

export function TeamPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function loadProfiles() {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at");
    setLoading(false);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setProfiles(data ?? []);
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function approve(targetUser: string, newRole: "admin" | "lawyer") {
    setApprovingId(targetUser);
    setError(null);
    const { error: rpcError } = await supabase.rpc("approve_user", {
      target_user: targetUser,
      new_role: newRole,
    });
    setApprovingId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await loadProfiles();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Team</h1>
      {loading && <p className="text-sm text-ink-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <ul className="grid max-w-3xl gap-3">
        {profiles.map((profile) => (
          <li key={profile.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{profile.full_name ?? profile.email}</div>
                <div className="text-sm text-ink-muted">{profile.email}</div>
              </div>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                {profile.role ?? "pending"}
              </span>
            </div>
            {profile.role === null && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void approve(profile.id, "lawyer")}
                  disabled={approvingId === profile.id}
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-canvas disabled:opacity-60"
                >
                  Approve as lawyer
                </button>
                <button
                  onClick={() => void approve(profile.id, "admin")}
                  disabled={approvingId === profile.id}
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-canvas disabled:opacity-60"
                >
                  Approve as admin
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

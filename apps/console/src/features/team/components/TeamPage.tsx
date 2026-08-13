import { Badge, Button } from "@legal-ai/ui";
import { useEffect, useState } from "react";
import { AppError } from "../../../shared/api/errors";
import { teamApi } from "../api";
import type { GrantableRole, TeamMember } from "../api";

export function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMembers(await teamApi.list());
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function approve(memberId: string, role: GrantableRole) {
    setApprovingId(memberId);
    setError(null);
    try {
      // The mutation returns the updated member (ADR-0012, convention 5), so
      // one row is replaced rather than the screen reloaded. The previous
      // version re-fetched everything, which threw away the approving admin's
      // scroll position to learn one field.
      const updated = await teamApi.approve(memberId, role);
      setMembers((current) =>
        current.map((member) => (member.id === updated.id ? updated : member)),
      );
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Team</h1>
      {loading && <p className="text-sm text-inkSoft">Loading…</p>}
      {error !== null && <p className="text-sm text-danger-ink">{error}</p>}
      <ul className="grid max-w-3xl gap-3">
        {members.map((member) => (
          <li key={member.id} className="rounded-card border border-line bg-paper p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{member.fullName ?? member.email}</div>
                <div className="text-sm text-inkSoft">{member.email}</div>
              </div>
              <Badge tone="neutral">{member.role ?? "pending"}</Badge>
            </div>
            {member.awaitingApproval && (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void approve(member.id, "lawyer")}
                  loading={approvingId === member.id}
                >
                  Approve as lawyer
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void approve(member.id, "admin")}
                  loading={approvingId === member.id}
                >
                  Approve as admin
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The component knows `AppError` and nothing narrower. No `PostgrestError`
 * reaches here any more, which is convention 4 — and the reason this screen no
 * longer imports the Supabase client at all.
 */
function messageOf(caught: unknown): string {
  if (caught instanceof AppError) return caught.message;
  return "Something went wrong. Please try again.";
}

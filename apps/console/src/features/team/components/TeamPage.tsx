import { useI18n, type TranslationKey } from "@legal-ai/i18n";
import { Badge, Button, EmptyState, Skeleton } from "@legal-ai/ui";
import { useEffect, useState } from "react";
import { AppError } from "../../../shared/api/errors";
import { teamApi } from "../api";
import type { GrantableRole, TeamMember } from "../api";

export function TeamPage() {
  const { t } = useI18n();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMembers(await teamApi.list());
    } catch (caught) {
      setError(messageKeyFor(caught, "team.error.load"));
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
      setError(messageKeyFor(caught, "team.error.approve"));
    } finally {
      setApprovingId(null);
    }
  }

  // The three states this screen used to collapse into one (DoD §4). It rendered
  // a line of text while loading and an empty `<ul>` for everything else, so a
  // request that failed and a firm with nobody in it looked identical — and the
  // second is the reading an admin would take, because it is the plausible one.
  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("team.title")}</h1>
        <Skeleton rows={3} label={t("team.loading")} className="max-w-3xl" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("team.title")}</h1>

      {error !== null && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-danger-ink">{t(error)}</p>
          <Button variant="secondary" onClick={() => void load()}>
            {t("common.tryAgain")}
          </Button>
        </div>
      )}

      {members.length === 0 &&
        (error === null ? (
          <EmptyState title={t("team.empty.title")} hint={t("team.empty.hint")} />
        ) : (
          // Deliberately not the sentence above: "nobody has registered" is a
          // fact about the firm, and this is a fact about the request.
          <EmptyState title={t("team.failed.title")} hint={t("team.failed.hint")} />
        ))}

      <ul className="grid max-w-3xl gap-3">
        {members.map((member) => (
          <li key={member.id} className="rounded-card border border-line bg-paper p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{member.fullName ?? member.email}</div>
                <div className="text-sm text-inkSoft">{member.email}</div>
              </div>
              {/* The role name itself stays as the system holds it: `admin` and
                  `lawyer` are values in the database and in the JWT, and a reader
                  comparing the screen to a policy needs the same word in both.
                  Only its absence — nobody approved yet — is a sentence. */}
              <Badge tone="neutral">{member.role ?? t("team.pending")}</Badge>
            </div>
            {member.awaitingApproval && (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void approve(member.id, "lawyer")}
                  loading={approvingId === member.id}
                >
                  {t("team.approveAsLawyer")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void approve(member.id, "admin")}
                  loading={approvingId === member.id}
                >
                  {t("team.approveAsAdmin")}
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
 * Which sentence a failure gets. A key, so the language is decided where it is
 * rendered rather than where it is caught — a reader who switches language
 * while an error is on screen keeps reading the current one, not the one that
 * was translated at catch time.
 *
 * Loading the list and approving someone are two different actions and must
 * not share one generic sentence, so the caller passes its own fallback key;
 * only the mapping from `AppError.code` to a specific key is shared.
 */
function messageKeyFor(caught: unknown, fallback: TranslationKey): TranslationKey {
  if (caught instanceof AppError) {
    switch (caught.code) {
      case "forbidden":
        return "team.error.forbidden";
      case "not_found":
        return "team.error.notFound";
      case "conflict":
        return "team.error.conflict";
      case "network":
        return "team.error.network";
      default:
        return fallback;
    }
  }
  return fallback;
}

// Who answers for a service, and the controls that change it (ADM-10).
//
// There is no dropdown here on purpose. `packages/ui` has no Select yet — it is
// item 1 of the design system's own wave — and inventing one locally is what
// DoD §6 forbids. Rows with actions need nothing that does not already exist,
// and for a firm with a handful of lawyers they read better than a picker.
//
// What is hidden here is presentation, not access control (DoD §7). Every
// refusal below is enforced by an RLS policy and covered by
// `supabase/snippets/verify_service_assignments.sql`; the buttons only avoid
// offering an action that would be refused.

import { Badge, Button } from "@legal-ai/ui";
import { useEffect, useState } from "react";
import { useAuth } from "../../../app/auth";
import { AppError } from "../../../shared/api/errors";
import {
  serviceDetailApi,
  type AssignableLawyer,
  type LawyerRef,
  type ServiceDetail,
} from "../api";

interface Props {
  service: ServiceDetail;
  /** The card owns the entity; every mutation returns the new one (ADR-0012). */
  onChanged: (next: ServiceDetail) => void;
}

function nameOf(lawyer: LawyerRef | AssignableLawyer): string {
  // A total formatter (DoD §5): a profile with no name is odd data, not a
  // reason to render a blank button.
  if ("email" in lawyer) return lawyer.fullName ?? lawyer.email;
  return lawyer.fullName ?? "name unavailable";
}

function messageFor(cause: unknown): string {
  if (cause instanceof AppError) {
    switch (cause.code) {
      case "forbidden":
        return "You may not make that change. Only an admin moves accountability, and only the accountable lawyer arranges cover.";
      case "conflict":
        return cause.message;
      case "not_found":
        return "This service no longer exists.";
      default:
        return cause.message;
    }
  }
  return "The change did not go through.";
}

export function AssignmentSection({ service, onChanged }: Props) {
  const { role, session } = useAuth();
  const currentUserId = session?.user.id ?? null;

  const isAdmin = role === "admin";
  // The case the table exists for: the accountable lawyer arranges their own
  // cover, so a Friday absence does not breach Monday's deadline (spec §13).
  const isPrimary = currentUserId !== null && service.primaryLawyer?.id === currentUserId;
  const canManageCover = isAdmin || isPrimary;
  const canEditAnything = isAdmin || canManageCover;

  const [lawyers, setLawyers] = useState<AssignableLawyer[] | null>(null);
  const [lawyersError, setLawyersError] = useState<string | null>(null);
  const [busyLawyerId, setBusyLawyerId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!canEditAnything) return;

    let cancelled = false;
    setLawyersError(null);

    serviceDetailApi
      .listAssignableLawyers()
      .then((result) => {
        if (!cancelled) setLawyers(result);
      })
      .catch(() => {
        if (cancelled) return;
        // Cleared first, so an empty list from a previous load is never shown
        // next to this error as though it were the answer (DoD §5).
        setLawyers(null);
        setLawyersError("Could not load the list of lawyers.");
      });

    return () => {
      cancelled = true;
    };
  }, [canEditAnything]);

  async function run(lawyerId: string, action: () => Promise<ServiceDetail>) {
    setBusyLawyerId(lawyerId);
    setActionError(null);
    try {
      onChanged(await action());
    } catch (cause: unknown) {
      setActionError(messageFor(cause));
    } finally {
      setBusyLawyerId(null);
    }
  }

  const attachedIds = new Set([
    ...(service.primaryLawyer === null ? [] : [service.primaryLawyer.id]),
    ...service.coverLawyers.map((lawyer) => lawyer.id),
  ]);
  const unattached = (lawyers ?? []).filter((lawyer) => !attachedIds.has(lawyer.id));

  return (
    <section className="space-y-4 rounded-card border border-line bg-paper p-4">
      <div>
        <h2 className="text-lg font-medium">Who answers for this service</h2>
        <p className="mt-1 text-sm text-inkSoft">
          One lawyer is accountable. Cover carries the same rights and none of the obligation.
        </p>
      </div>

      {actionError !== null && (
        <p role="alert" className="text-sm text-danger-ink">
          {actionError}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-inkSoft">Accountable</h3>
        {service.primaryLawyer === null ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge tone="warn">Nobody accountable</Badge>
            <span className="text-inkMute">This service cannot be published in this state.</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>{nameOf(service.primaryLawyer)}</span>
            {isAdmin && (
              <Button
                variant="ghost"
                loading={busyLawyerId === service.primaryLawyer.id}
                onClick={() => {
                  const primary = service.primaryLawyer;
                  if (primary !== null) {
                    void run(primary.id, () => serviceDetailApi.setPrimaryLawyer(service.id, null));
                  }
                }}
              >
                Leave nobody accountable
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-inkSoft">Cover</h3>
        {service.coverLawyers.length === 0 ? (
          <p className="text-sm text-inkMute">Nobody is covering this service.</p>
        ) : (
          <ul className="space-y-1">
            {service.coverLawyers.map((lawyer) => (
              <li key={lawyer.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{nameOf(lawyer)}</span>
                <span className="flex gap-1">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      loading={busyLawyerId === lawyer.id}
                      onClick={() =>
                        void run(lawyer.id, () =>
                          serviceDetailApi.setPrimaryLawyer(service.id, lawyer.id),
                        )
                      }
                    >
                      Make accountable
                    </Button>
                  )}
                  {canManageCover && (
                    <Button
                      variant="ghost"
                      loading={busyLawyerId === lawyer.id}
                      onClick={() =>
                        void run(lawyer.id, () =>
                          serviceDetailApi.removeCover(service.id, lawyer.id),
                        )
                      }
                    >
                      Remove
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEditAnything && (
        <div className="space-y-2 border-t border-line pt-4">
          <h3 className="text-sm font-medium text-inkSoft">Attach a lawyer</h3>

          {lawyersError !== null ? (
            <p className="text-sm text-danger-ink">{lawyersError}</p>
          ) : lawyers === null ? (
            <p className="text-sm text-inkMute">Loading lawyers…</p>
          ) : unattached.length === 0 ? (
            <p className="text-sm text-inkMute">
              {lawyers.length === 0
                ? "No approved lawyers yet."
                : "Every lawyer is already attached to this service."}
            </p>
          ) : (
            <ul className="space-y-1">
              {unattached.map((lawyer) => (
                <li key={lawyer.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{nameOf(lawyer)}</span>
                  <span className="flex gap-1">
                    {canManageCover && (
                      <Button
                        variant="secondary"
                        loading={busyLawyerId === lawyer.id}
                        onClick={() =>
                          void run(lawyer.id, () =>
                            serviceDetailApi.addCover(service.id, lawyer.id),
                          )
                        }
                      >
                        Add as cover
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        loading={busyLawyerId === lawyer.id}
                        onClick={() =>
                          void run(lawyer.id, () =>
                            serviceDetailApi.setPrimaryLawyer(service.id, lawyer.id),
                          )
                        }
                      >
                        Make accountable
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

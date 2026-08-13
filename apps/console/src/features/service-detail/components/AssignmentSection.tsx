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

import { useI18n, type TranslationKey } from "@legal-ai/i18n";
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

/**
 * Which sentence a failure gets. A key, so the language is decided where it is
 * rendered rather than where it is caught.
 *
 * `conflict` and the default used to fall through to `cause.message`, which is
 * developer text ("expected one record, got 2") in whatever language the source
 * file was written in. `useCatalogue` already refused that fall-through; this
 * screen was the place it survived.
 */
function messageKeyFor(cause: unknown): TranslationKey {
  if (cause instanceof AppError) {
    switch (cause.code) {
      case "forbidden":
        return "assignment.error.forbidden";
      case "conflict":
        return "assignment.error.conflict";
      case "not_found":
        return "assignment.error.notFound";
      default:
        return "assignment.error.failed";
    }
  }
  return "assignment.error.failed";
}

export function AssignmentSection({ service, onChanged }: Props) {
  const { role, session } = useAuth();
  const { t } = useI18n();
  const currentUserId = session?.user.id ?? null;

  function nameOf(lawyer: LawyerRef | AssignableLawyer): string {
    // A total formatter (DoD §5): a profile with no name is odd data, not a
    // reason to render a blank button.
    if ("email" in lawyer) return lawyer.fullName ?? lawyer.email;
    return lawyer.fullName ?? t("service.nameUnavailable");
  }

  const isAdmin = role === "admin";
  // The case the table exists for: the accountable lawyer arranges their own
  // cover, so a Friday absence does not breach Monday's deadline (spec §13).
  const isPrimary = currentUserId !== null && service.primaryLawyer?.id === currentUserId;
  const canManageCover = isAdmin || isPrimary;
  const canEditAnything = isAdmin || canManageCover;

  const [lawyers, setLawyers] = useState<AssignableLawyer[] | null>(null);
  const [lawyersFailed, setLawyersFailed] = useState(false);
  const [busyLawyerId, setBusyLawyerId] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    if (!canEditAnything) return;

    let cancelled = false;
    setLawyersFailed(false);

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
        setLawyersFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [canEditAnything]);

  async function run(lawyerId: string, action: () => Promise<ServiceDetail>) {
    setBusyLawyerId(lawyerId);
    setActionErrorKey(null);
    try {
      onChanged(await action());
    } catch (cause: unknown) {
      setActionErrorKey(messageKeyFor(cause));
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
        <h2 className="text-lg font-medium">{t("assignment.title")}</h2>
        <p className="mt-1 text-sm text-inkSoft">{t("assignment.subtitle")}</p>
      </div>

      {actionErrorKey !== null && (
        <p role="alert" className="text-sm text-danger-ink">
          {t(actionErrorKey)}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-inkSoft">{t("assignment.accountable")}</h3>
        {service.primaryLawyer === null ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge tone="warn">{t("assignment.nobodyAccountable")}</Badge>
            <span className="text-inkMute">{t("assignment.nobodyAccountableHint")}</span>
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
                {t("assignment.leaveNobody")}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-inkSoft">{t("assignment.cover")}</h3>
        {service.coverLawyers.length === 0 ? (
          <p className="text-sm text-inkMute">{t("assignment.noCover")}</p>
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
                      {t("assignment.makeAccountable")}
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
                      {t("assignment.remove")}
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
          <h3 className="text-sm font-medium text-inkSoft">{t("assignment.attach")}</h3>

          {lawyersFailed ? (
            <p className="text-sm text-danger-ink">{t("assignment.lawyersFailed")}</p>
          ) : lawyers === null ? (
            <p className="text-sm text-inkMute">{t("assignment.loadingLawyers")}</p>
          ) : unattached.length === 0 ? (
            <p className="text-sm text-inkMute">
              {lawyers.length === 0 ? t("assignment.noLawyers") : t("assignment.allAttached")}
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
                        {t("assignment.addAsCover")}
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
                        {t("assignment.makeAccountable")}
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

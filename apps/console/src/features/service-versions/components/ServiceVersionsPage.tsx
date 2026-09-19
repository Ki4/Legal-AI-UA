// The versions of one service (§4.3): three acts on three columns, and a pause
// as a row with a reason (§5.7). The first screen ADR-0027 gets.
//
// What §4.3 also lists and this screen does not build: creating a version from
// the current one — that is the authoring editor's act (ADM-30 and the block
// editor), and a "new version" button here with nothing to edit behind it
// would be a promise the console cannot keep. The bound template version is
// not shown either: templates are not in the schema yet.

import { useState } from "react";
import { useI18n } from "@legal-ai/i18n";
import { Button, EmptyState, Spinner, Switch, useConfirm } from "@legal-ai/ui";
import { Link, useParams } from "react-router";
import { useAuth } from "../../../app/auth";
import { availableActions, type PauseReason, type VersionAction, type VersionItem } from "../api";
import { useServiceVersions } from "../hooks/useServiceVersions";
import { LiftDialog } from "./LiftDialog";
import { PauseDialog } from "./PauseDialog";
import { SignatoriesSection } from "./SignatoriesSection";
import { VersionsTable } from "./VersionsTable";

type OpenDialog =
  | { kind: "pause"; version: VersionItem; reasons: readonly PauseReason[] }
  | { kind: "lift"; version: VersionItem; pauseId: string }
  | null;

export function ServiceVersionsPage() {
  const { t, tCount, locale } = useI18n();
  const { serviceId = "" } = useParams();
  const { role, session } = useAuth();
  const viewer = { userId: session?.user.id ?? null, role };
  const state = useServiceVersions(serviceId);
  const { page, loading, notFound, errorKey, acting, actErrorKey, reload } = state;

  const { confirm, confirmation } = useConfirm();
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">{t("versions.loading")}</span>
      </div>
    );
  }

  if (notFound) {
    return <EmptyState title={t("versions.notFound.title")} hint={t("versions.notFound.hint")} />;
  }

  const versions = page?.versions ?? [];
  const shown = showArchived ? versions : versions.filter((v) => v.status !== "archived");
  const archivedCount = versions.length - shown.length;

  const act = (version: VersionItem, action: VersionAction) => {
    switch (action.kind) {
      case "submitForReview":
        void state.submitForReview(version.id);
        return;
      case "returnToDraft":
        void state.returnToDraft(version.id);
        return;
      case "release":
        void confirm({
          title: t("versions.release.title", { version: version.version }),
          description: t(
            action.self ? "versions.release.selfDescription" : "versions.release.description",
          ),
          confirmLabel: t("versions.release.confirm"),
          cancelLabel: t("versions.release.cancel"),
        }).then((yes) => {
          if (yes) void state.release(version.id);
        });
        return;
      case "putOnSale":
        void confirm({
          title: t("versions.sale.title", { version: version.version }),
          description: t("versions.sale.description"),
          confirmLabel: t("versions.sale.confirm"),
          cancelLabel: t("versions.sale.cancel"),
        }).then((yes) => {
          if (yes) void state.putOnSale(version.id);
        });
        return;
      case "pause":
        setDialog({ kind: "pause", version, reasons: action.reasons });
        return;
      case "lift":
        setDialog({ kind: "lift", version, pauseId: action.pauseId });
        return;
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("versions.title")}</h1>
        {page !== null && (
          // check-copy-ignore: the service title is data
          <p className="mt-1 text-sm text-inkSoft">{page.service.title}</p>
        )}
        <p className="mt-1 text-sm text-inkSoft">{t("versions.subtitle")}</p>
        <Link
          to={`/services/${serviceId}`}
          className="mt-2 inline-block text-sm text-brand hover:underline"
        >
          {t("versions.backToService")}
        </Link>
      </div>

      {errorKey !== null || page === null ? (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm text-danger-ink">{t(errorKey ?? "versions.error.load")}</p>
            <Button variant="secondary" onClick={reload}>
              {t("common.tryAgain")}
            </Button>
          </div>
          {/* Not the empty state: no versions after a failed load is not no
              versions (DoD §4). */}
          <EmptyState title={t("versions.failed.title")} hint={t("versions.failed.hint")} />
        </>
      ) : (
        <>
          <SignatoriesSection
            signatories={page.signatories}
            areaLabel={page.service.practiceArea?.labels[locale] ?? page.service.practiceAreaCode}
          />

          {actErrorKey !== null && dialog === null && (
            <p className="text-sm text-danger-ink" role="alert">
              {t(actErrorKey)}
            </p>
          )}

          {versions.length === 0 ? (
            <EmptyState title={t("versions.empty.title")} hint={t("versions.empty.hint")} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Switch
                  label={t("versions.showArchived")}
                  description={t("versions.showArchivedHint")}
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                />
                {archivedCount > 0 && (
                  <p className="text-xs text-inkMute">
                    {tCount("versions.archivedHidden", archivedCount)}
                  </p>
                )}
              </div>
              <VersionsTable
                versions={shown}
                actionsFor={(version) => availableActions(version, page, viewer)}
                busyId={acting?.targetId ?? null}
                onAct={act}
              />
            </>
          )}
        </>
      )}

      {dialog?.kind === "pause" && (
        <PauseDialog
          version={dialog.version}
          reasons={dialog.reasons}
          busy={acting?.kind === "pause"}
          errorKey={actErrorKey}
          onCancel={() => setDialog(null)}
          onConfirm={(input) => {
            void state.pause(dialog.version.id, input).then((done) => {
              if (done) setDialog(null);
            });
          }}
        />
      )}
      {dialog?.kind === "lift" && (
        <LiftDialog
          version={dialog.version}
          busy={acting?.kind === "lift"}
          errorKey={actErrorKey}
          onCancel={() => setDialog(null)}
          onConfirm={(resolution) => {
            void state.lift(dialog.pauseId, resolution).then((done) => {
              if (done) setDialog(null);
            });
          }}
        />
      )}
      {confirmation}
    </section>
  );
}

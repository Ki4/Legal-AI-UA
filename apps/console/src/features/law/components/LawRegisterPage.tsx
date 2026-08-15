// The register (§4.11). Every norm the platform watches, once each, with the
// services resting on it listed against it.

import { useState } from "react";
import { useI18n } from "@legal-ai/i18n";
import { Button, EmptyState, Spinner } from "@legal-ai/ui";
import { useLawRegister } from "../hooks/useLawRegister";
import type { LawNormListItem } from "../api";
import { CadenceEditor } from "./CadenceEditor";
import { NormsTable } from "./NormsTable";

export function LawRegisterPage() {
  const { t } = useI18n();
  const { norms, loading, errorKey, savingNormId, saveErrorKey, setCadence, reload } =
    useLawRegister();
  const [editing, setEditing] = useState<LawNormListItem | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">{t("law.loading")}</span>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("law.title")}</h1>
        {/* The one thing a reader cannot deduce from the table: the register is
            shared, so a cadence changed here is changed for every service in
            the last column (§9.3). */}
        <p className="mt-1 text-sm text-inkSoft">{t("law.subtitle")}</p>
      </div>

      {errorKey !== null ? (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm text-danger-ink">{t(errorKey)}</p>
            <Button variant="secondary" onClick={reload}>
              {t("common.tryAgain")}
            </Button>
          </div>
          {/* An empty register after a failed load is not an empty register.
              Telling a lawyer nothing is watched when the request simply broke
              is the mistake DoD §4 names as the most repeatable one here — and
              on this screen it reads as "no law is being monitored". */}
          <EmptyState title={t("law.failed.title")} hint={t("law.failed.hint")} />
        </>
      ) : norms === null || norms.length === 0 ? (
        <EmptyState title={t("law.empty.title")} hint={t("law.empty.hint")} />
      ) : (
        <>
          <NormsTable norms={norms} savingNormId={savingNormId} onEdit={setEditing} />

          {/* Kept apart from the load error above: the list is on screen and
              intact, and what failed is the change the reader just asked for. */}
          {saveErrorKey !== null && <p className="text-sm text-danger-ink">{t(saveErrorKey)}</p>}

          {editing !== null && (
            <CadenceEditor
              norm={editing}
              saving={savingNormId === editing.id}
              onSave={(change) => {
                void setCadence(change).then((saved) => {
                  if (saved) setEditing(null);
                });
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </>
      )}
    </section>
  );
}

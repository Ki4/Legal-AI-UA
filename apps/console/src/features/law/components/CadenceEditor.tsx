// Changing how often one norm is probed (§9.8).
//
// Inline rather than in a dialog, because `packages/ui` has no Dialog yet and
// building one as a side effect of wanting a form is how a shared primitive ends
// up shaped by the first screen that needed it — the mistake DoD §6 names ADM-10
// for. This is a panel under the table, and it says which norm it is editing.
//
// The reason field is always offered rather than revealed when the value stops
// matching the recommendation. The screen does not know the recommendation:
// `recommended_probe_interval` reads whether any *published* service depends on
// the norm, and this list holds dependent services without their version
// statuses. Guessing would produce a field that appears and disappears while a
// lawyer types, and a refusal they were told would not come.

import { useState } from "react";
import { useI18n } from "@legal-ai/i18n";
import { Button, FormField, Input } from "@legal-ai/ui";
import type { CadenceChange, LawNormListItem } from "../api";

export function CadenceEditor({
  norm,
  saving,
  onSave,
  onCancel,
}: {
  norm: LawNormListItem;
  saving: boolean;
  onSave: (change: CadenceChange) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [hours, setHours] = useState(String(norm.probeIntervalHours));
  const [reason, setReason] = useState(norm.intervalReason ?? "");

  return (
    <form
      className="space-y-4 rounded-card border border-line bg-paper p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          normId: norm.id,
          hours: Number(hours),
          // Empty is null rather than "": the column's check reads a blank
          // string as no reason at all, and sending one would have the guard
          // refuse a write the screen believed it had filled in.
          reason: reason.trim() === "" ? null : reason.trim(),
        });
      }}
    >
      <p className="text-sm text-inkSoft">
        {/* check-copy-ignore: an act title and article are data */}
        {norm.actTitle} {norm.article ?? ""}
      </p>

      <FormField label={t("law.cadence.hours")} htmlFor="cadence-hours">
        <Input
          id="cadence-hours"
          type="number"
          min={1}
          value={hours}
          onChange={(event) => setHours(event.target.value)}
        />
      </FormField>

      <FormField
        label={t("law.cadence.reason")}
        htmlFor="cadence-reason"
        hint={t("law.cadence.reasonHint")}
      >
        <Input
          id="cadence-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {t(saving ? "law.cadence.saving" : "law.cadence.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          {t("law.cadence.cancel")}
        </Button>
      </div>
    </form>
  );
}

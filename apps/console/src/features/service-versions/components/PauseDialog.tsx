// Opening a pause (§5.7): a reason, and an internal note.
//
// The reason is a radio group, not a select, because the choice has
// consequences the reader has to see before choosing — who will be able to
// lift it, and whether orders in flight go to review. A select hides the
// options until opened; a radio group lays them out with a line each.

import { useState } from "react";
import { useI18n, type TranslationKey } from "@legal-ai/i18n";
import { Button, Dialog, FormField, RadioGroup, Textarea } from "@legal-ai/ui";
import { pauseReasonKey } from "../../../shared/vocabulary";
import type { PauseInput, PauseReason, VersionItem } from "../api";

/** The reasons that send orders in flight to review (§5.7, point 2). */
const SENDS_TO_REVIEW: ReadonlySet<PauseReason> = new Set(["law_impact", "defect", "generation"]);

export function PauseDialog({
  version,
  reasons,
  busy,
  errorKey,
  onConfirm,
  onCancel,
}: {
  version: VersionItem;
  /** What the viewer may pick — an admin's list includes `commercial`, a lawyer's does not. */
  reasons: readonly PauseReason[];
  busy: boolean;
  /**
   * A refusal that arrived while this dialog was open. Rendered here, because
   * a native modal makes the page behind it inert — a sentence out there is a
   * sentence nobody reads.
   */
  errorKey: TranslationKey | null;
  onConfirm: (input: PauseInput) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState<PauseReason | null>(null);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  const submit = () => {
    setTried(true);
    if (reason === null) return;
    onConfirm({ reason, note: note.trim() === "" ? null : note.trim() });
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("versions.pauseDialog.title", { version: version.version })}
      closeLabel={t("versions.pauseDialog.close")}
      width="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t("versions.pauseDialog.cancel")}
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            {t("versions.pauseDialog.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RadioGroup
          name="pause-reason"
          legend={t("versions.pauseDialog.reason")}
          hint={t("versions.pauseDialog.reasonHint")}
          error={tried && reason === null ? t("versions.pauseDialog.reasonRequired") : undefined}
          options={reasons.map((value) => ({
            value,
            label: t(pauseReasonKey[value]),
            description: SENDS_TO_REVIEW.has(value)
              ? t("versions.pauseDialog.reviewNote")
              : undefined,
          }))}
          value={reason}
          onValueChange={(value) => setReason(value as PauseReason)}
          disabled={busy}
        />

        <FormField
          htmlFor="pause-note"
          label={t("versions.pauseDialog.note")}
          hint={t("versions.pauseDialog.noteHint")}
        >
          <Textarea
            id="pause-note"
            rows={3}
            value={note}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
        {errorKey !== null && (
          <p className="text-sm text-danger-ink" role="alert">
            {t(errorKey)}
          </p>
        )}
      </div>
    </Dialog>
  );
}

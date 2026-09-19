// Closing a pause (§5.7): resumed or archived. `new_version` is not on offer —
// the fix going on sale writes it — and the dialog says so, because a reader
// holding a corrected draft would otherwise archive the old version by hand
// and lose the link between the pause and its fix.

import { useState } from "react";
import { useI18n } from "@legal-ai/i18n";
import { Button, Dialog, RadioGroup } from "@legal-ai/ui";
import type { LiftResolution, VersionItem } from "../api";

export function LiftDialog({
  version,
  busy,
  onConfirm,
  onCancel,
}: {
  version: VersionItem;
  busy: boolean;
  onConfirm: (resolution: LiftResolution) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [resolution, setResolution] = useState<LiftResolution | null>(null);
  const [tried, setTried] = useState(false);

  const submit = () => {
    setTried(true);
    if (resolution === null) return;
    onConfirm(resolution);
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("versions.liftDialog.title", { version: version.version })}
      closeLabel={t("versions.liftDialog.close")}
      width="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t("versions.liftDialog.cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t("versions.liftDialog.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RadioGroup
          name="lift-resolution"
          legend={t("versions.liftDialog.resolution")}
          error={
            tried && resolution === null ? t("versions.liftDialog.resolutionRequired") : undefined
          }
          options={[
            {
              value: "resumed",
              label: t("versions.liftDialog.resumed"),
              description: t("versions.liftDialog.resumedHint"),
            },
            {
              value: "archived",
              label: t("versions.liftDialog.archived"),
              description: t("versions.liftDialog.archivedHint"),
            },
          ]}
          value={resolution}
          onValueChange={(value) => setResolution(value as LiftResolution)}
          disabled={busy}
        />
        <p className="text-sm text-inkSoft">{t("versions.liftDialog.newVersionNote")}</p>
      </div>
    </Dialog>
  );
}

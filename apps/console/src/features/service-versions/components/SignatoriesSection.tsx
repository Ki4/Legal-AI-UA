// Who signs for the service's practice area (§5.6). Read-only here: appointing
// a head is an admin's act and appointing reviewers is the head's, and both
// belong to the area's own screen, not to one service's versions. What this
// section owes the reader is the answer to "why is there no release button" —
// which, for an area with nobody, is the whole answer.

import { useI18n } from "@legal-ai/i18n";
import { Badge } from "@legal-ai/ui";
import type { Signatory } from "../api";

export function SignatoriesSection({
  signatories,
  areaLabel,
}: {
  signatories: readonly Signatory[];
  areaLabel: string;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-card border border-line bg-paper p-4 text-sm">
      <h2 className="font-medium">{t("versions.signatories.title", { area: areaLabel })}</h2>
      {signatories.length === 0 ? (
        <div className="mt-1 text-inkSoft">
          <p>{t("versions.signatories.none")}</p>
          <p className="text-xs text-inkMute">{t("versions.signatories.noneHint")}</p>
        </div>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-3">
          {signatories.map((s) => (
            <li key={s.lawyer.id} className="flex items-center gap-2">
              {s.lawyer.fullName === null ? (
                <span className="text-inkMute">{t("versions.nameUnavailable")}</span>
              ) : (
                // check-copy-ignore: a person's name is data
                <span>{s.lawyer.fullName}</span>
              )}
              <Badge tone={s.isHead ? "brand" : "neutral"}>
                {t(s.isHead ? "versions.signatories.head" : "versions.signatories.reviewer")}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

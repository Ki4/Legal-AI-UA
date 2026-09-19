// Every version with its three names (§4.3), and the acts the viewer may take
// on each. What is hidden here is presentation, not access control (DoD §7):
// `availableActions` mirrors the guards and the RPC, and the database is what
// refuses.

import { useI18n } from "@legal-ai/i18n";
import type { BadgeTone } from "@legal-ai/ui";
import { Badge, Button, Table, TableCell, TableHead, TableRow } from "@legal-ai/ui";
import { formatDate, formatMoney } from "../../../shared/format";
import {
  generationModeKey,
  pauseReasonKey,
  pauseResolutionKey,
  reviewModeKey,
  serviceStatusKey,
} from "../../../shared/vocabulary";
import type {
  PauseItem,
  Release,
  Sale,
  ServiceStatus,
  StaffRef,
  VersionAction,
  VersionItem,
} from "../api";

// The same mapping `features/services` keeps; repeated rather than imported,
// because a feature may not reach into a sibling. What must not diverge is the
// colour of `paused`, and it is `warn` in both places.
const statusTone: Record<ServiceStatus, BadgeTone> = {
  published: "ok",
  draft: "neutral",
  in_review: "neutral",
  paused: "warn",
  archived: "neutral",
};

function Name({ who }: { who: StaffRef }) {
  const { t } = useI18n();
  // Two nulls kept apart: a row with an id and no readable profile is a
  // person, not nobody (DoD §5).
  if (who.fullName === null)
    return <span className="text-inkMute">{t("versions.nameUnavailable")}</span>;
  // check-copy-ignore: a person's name is data
  return <span>{who.fullName}</span>;
}

function ReleaseCell({ release }: { release: Release }) {
  const { t, intlLocale } = useI18n();
  switch (release.kind) {
    case "none":
      return <span className="text-inkMute">{t("versions.notReleased")}</span>;
    case "unsigned":
      return (
        <div className="space-y-1">
          <p className="text-inkSoft">{t("versions.releasedByNobody")}</p>
          <p className="text-xs text-inkMute">{formatDate(release.at, intlLocale)}</p>
        </div>
      );
    case "signed":
      return (
        <div className="space-y-1">
          <p>
            <Name who={release.by} />
          </p>
          <p className="text-xs text-inkMute">{formatDate(release.at, intlLocale)}</p>
          {release.selfReleased && (
            <Badge tone="warn" title={t("versions.selfReleasedHint")}>
              {t("versions.selfReleased")}
            </Badge>
          )}
        </div>
      );
  }
}

function SaleCell({ sale }: { sale: Sale | null }) {
  const { t, intlLocale } = useI18n();
  if (sale === null) return <span className="text-inkMute">{t("versions.notOnSale")}</span>;
  return (
    <div className="space-y-1">
      <p>
        {sale.by === null ? (
          <span className="text-inkMute">{t("versions.nameUnavailable")}</span>
        ) : (
          <Name who={sale.by} />
        )}
      </p>
      <p className="text-xs text-inkMute">{formatDate(sale.at, intlLocale)}</p>
    </div>
  );
}

function PauseLine({ pause }: { pause: PauseItem }) {
  const { t, intlLocale } = useI18n();
  const opened = formatDate(pause.openedAt, intlLocale);
  return (
    <div className="space-y-0.5 text-xs">
      <p className={pause.outcome.kind === "open" ? "text-warn-ink" : "text-inkSoft"}>
        {t("versions.pause.open", { reason: t(pauseReasonKey[pause.reason]) })}
      </p>
      <p className="text-inkMute">
        {pause.openedBy === null || pause.openedBy.fullName === null
          ? t("versions.pause.openedByUnnamed", { date: opened })
          : t("versions.pause.openedBy", { name: pause.openedBy.fullName, date: opened })}
      </p>
      {pause.outcome.kind === "closed" && (
        <p className="text-inkMute">
          {t("versions.pause.closed", {
            date: formatDate(pause.outcome.at, intlLocale),
            resolution: t(pauseResolutionKey[pause.outcome.resolution]),
          })}
          {pause.outcome.replacedByVersion !== null &&
            ` — ${t("versions.pause.replacedBy", { version: pause.outcome.replacedByVersion })}`}
        </p>
      )}
      {pause.note !== null && (
        <p className="text-inkSoft">
          {t("versions.pause.note")}: {/* check-copy-ignore: the note is a lawyer's own sentence */}
          {pause.note}
        </p>
      )}
    </div>
  );
}

export interface VersionsTableProps {
  versions: readonly VersionItem[];
  actionsFor: (version: VersionItem) => VersionAction[];
  /** The version (or pause) an act is running on, so its row shows a spinner and the rest stay quiet. */
  busyId: string | null;
  onAct: (version: VersionItem, action: VersionAction) => void;
}

export function VersionsTable({ versions, actionsFor, busyId, onAct }: VersionsTableProps) {
  const { t, intlLocale } = useI18n();

  const label = (action: VersionAction) => {
    switch (action.kind) {
      case "submitForReview":
        return t("versions.action.submitForReview");
      case "returnToDraft":
        return t("versions.action.backToDraft");
      case "release":
        return t("versions.action.release");
      case "putOnSale":
        return t("versions.action.putOnSale");
      case "pause":
        return t("versions.action.pause");
      case "lift":
        return t("versions.action.lift");
    }
  };

  return (
    <Table>
      <TableHead>
        <tr>
          <th>{t("versions.column.version")}</th>
          <th>{t("versions.column.status")}</th>
          <th>{t("versions.column.modes")}</th>
          <th>{t("versions.column.price")}</th>
          <th>{t("versions.column.author")}</th>
          <th>{t("versions.column.released")}</th>
          <th>{t("versions.column.sold")}</th>
          <th>{t("versions.column.actions")}</th>
        </tr>
      </TableHead>
      <tbody>
        {versions.map((version) => {
          const actions = actionsFor(version);
          const busy = busyId === version.id || busyId === version.openPause?.id;
          return (
            <TableRow key={version.id}>
              <TableCell>
                <p className="font-medium">
                  {t("service.versionShort", { version: version.version })}
                </p>
                <p className="text-xs text-inkMute">{formatDate(version.createdAt, intlLocale)}</p>
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Badge tone={statusTone[version.status]}>
                    {t(serviceStatusKey[version.status])}
                  </Badge>
                  {version.pauses.map((pause) => (
                    <PauseLine key={pause.id} pause={pause} />
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <p>{t(generationModeKey[version.generationMode])}</p>
                <p className="text-xs text-inkMute">{t(reviewModeKey[version.reviewMode])}</p>
              </TableCell>
              <TableCell>
                {version.priceMinor !== null && version.currency !== null
                  ? formatMoney(version.priceMinor, version.currency, intlLocale)
                  : "—"}
              </TableCell>
              <TableCell>
                {version.author === null ? (
                  <span className="text-inkMute">{t("versions.noAuthor")}</span>
                ) : (
                  <Name who={version.author} />
                )}
              </TableCell>
              <TableCell>
                <ReleaseCell release={version.release} />
              </TableCell>
              <TableCell>
                <SaleCell sale={version.sale} />
              </TableCell>
              <TableCell>
                {actions.length === 0 ? (
                  <span className="text-xs text-inkMute">{t("versions.action.none")}</span>
                ) : (
                  <div className="flex flex-col items-start gap-1">
                    {actions.map((action) => (
                      <Button
                        key={action.kind}
                        variant={action.kind === "pause" ? "danger" : "secondary"}
                        disabled={busyId !== null}
                        loading={busy}
                        onClick={() => onAct(version, action)}
                      >
                        {label(action)}
                      </Button>
                    ))}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </tbody>
    </Table>
  );
}

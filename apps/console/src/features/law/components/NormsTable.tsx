// The register's rows. Loading, emptiness and errors belong to the page.
//
// Two badges per norm, not one, and that is the point of the screen. The state
// badge says what the last check found; the freshness badge says whether there
// has been one. §9.10 exists because those are different facts and a single
// green dot collapses them — a norm last verified in July, with a fetcher that
// has been broken since, is `verified` and is not fine.

import { useI18n } from "@legal-ai/i18n";
import { Badge, Button, Table, TableCell, TableHead, TableRow } from "@legal-ai/ui";
import { Link } from "react-router";
import { formatDate } from "../../../shared/format";
import { lawNormStateKey } from "../../../shared/vocabulary";
import type { LawNormListItem, NormFreshness } from "../api";
import { cadencePhrase } from "./cadence";
import { freshnessTone, normStateTone } from "./tone";

export function Freshness({ freshness }: { freshness: NormFreshness }) {
  const { t, intlLocale } = useI18n();

  if (freshness.kind === "never_checked") {
    return <Badge tone={freshnessTone(freshness)}>{t("law.freshness.never")}</Badge>;
  }

  const when = formatDate(freshness.verifiedAt, intlLocale);

  return (
    <Badge tone={freshnessTone(freshness)}>
      {t(freshness.kind === "fresh" ? "law.freshness.fresh" : "law.freshness.stale", { when })}
    </Badge>
  );
}

export function Dependents({ norm }: { norm: LawNormListItem }) {
  const { t, tCount } = useI18n();

  if (norm.dependents.length === 0) {
    // Not a dash. A norm nothing rests on is a real and slightly odd state — it
    // is watched and no document depends on it — and a dash would read as
    // missing data.
    return <span className="text-inkMute">{t("law.dependents.none")}</span>;
  }

  return (
    <div className="space-y-1">
      <p className="text-inkSoft">{tCount("law.dependents", norm.dependents.length)}</p>
      <ul className="space-y-0.5">
        {norm.dependents.map((dependent) => (
          <li key={dependent.serviceId}>
            <Link
              to={`/services/${dependent.serviceId}/law`}
              className="text-brand hover:underline"
            >
              {/* check-copy-ignore: a service title is data an admin typed */}
              {dependent.serviceTitle}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NormsTable({
  norms,
  savingNormId,
  onEdit,
}: {
  norms: LawNormListItem[];
  savingNormId: string | null;
  onEdit: (norm: LawNormListItem) => void;
}) {
  const { t, tCount } = useI18n();

  return (
    <Table>
      <TableHead>
        <tr>
          <th>{t("law.field.act")}</th>
          <th>{t("law.field.article")}</th>
          <th>{t("law.field.state")}</th>
          <th>{t("law.field.freshness")}</th>
          <th>{t("law.field.cadence")}</th>
          <th>{t("law.field.dependents")}</th>
        </tr>
      </TableHead>
      <tbody>
        {norms.map((norm) => {
          const cadence = cadencePhrase(norm.probeIntervalHours);

          return (
            <TableRow key={norm.id}>
              <TableCell>
                <div className="space-y-1">
                  {/* The act title is what a lawyer recognizes; the identifier
                      is what the platform watches, and both are on the row
                      because a reader checking a citation needs the second. */}
                  {/* check-copy-ignore: an act title is data a lawyer typed */}
                  <p className="font-medium">{norm.actTitle}</p>
                  <a
                    href={norm.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand hover:underline"
                  >
                    {t("law.openSource")}
                  </a>
                </div>
              </TableCell>
              <TableCell>
                {norm.article === null ? (
                  // §9.4's marked exception, rendered as the exception it is
                  // rather than as an empty cell.
                  <Badge tone="warn">{t("law.wholeAct")}</Badge>
                ) : (
                  // check-copy-ignore: an article number is data
                  <span>{norm.article}</span>
                )}
              </TableCell>
              <TableCell>
                <Badge tone={normStateTone(norm.state)}>{t(lawNormStateKey[norm.state])}</Badge>
              </TableCell>
              <TableCell>
                <Freshness freshness={norm.freshness} />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p>{tCount(cadence.key, cadence.count)}</p>
                  <Button
                    variant="secondary"
                    onClick={() => onEdit(norm)}
                    disabled={savingNormId !== null}
                  >
                    {t(savingNormId === norm.id ? "law.cadence.saving" : "law.cadence.change")}
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <Dependents norm={norm} />
              </TableCell>
            </TableRow>
          );
        })}
      </tbody>
    </Table>
  );
}

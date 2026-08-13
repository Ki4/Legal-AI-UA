// The dense rendering. Better than any grid at forty rows, which is why it
// stays rather than being replaced by the cards (§4.1).
//
// It renders rows and nothing else: loading, the three emptinesses and the
// errors belong to the page, because they are the same regardless of which
// rendering the reader picked.

import { useI18n } from "@legal-ai/i18n";
import { Badge, Table, TableCell, TableHead, TableRow } from "@legal-ai/ui";
import { Link } from "react-router";
import { formatMoney } from "../../../shared/format";
import { generationModeKey, reviewModeKey, serviceStatusKey } from "../../../shared/vocabulary";
import type { ServiceListItem } from "../api";
import { statusTone } from "./statusTone";

export function ServicesTable({ services }: { services: ServiceListItem[] }) {
  const { t, locale, intlLocale } = useI18n();

  return (
    <Table>
      <TableHead>
        <tr>
          <th>{t("service.field.service")}</th>
          <th>{t("service.field.area")}</th>
          <th>{t("service.field.generationMode")}</th>
          <th>{t("service.field.reviewMode")}</th>
          <th>{t("service.field.lawyer")}</th>
          <th>{t("service.field.price")}</th>
          <th>{t("service.field.version")}</th>
          <th>{t("service.field.status")}</th>
        </tr>
      </TableHead>
      <tbody>
        {services.map((service) => (
          <TableRow key={service.id}>
            <TableCell>
              <Link to={`/services/${service.id}`} className="font-medium hover:underline">
                {service.title}
              </Link>
            </TableCell>
            <TableCell>{service.practiceArea.labels[locale]}</TableCell>
            <TableCell>
              {service.currentVersion
                ? t(generationModeKey[service.currentVersion.generationMode])
                : "—"}
            </TableCell>
            <TableCell>
              {service.currentVersion ? t(reviewModeKey[service.currentVersion.reviewMode]) : "—"}
            </TableCell>
            <TableCell>
              {service.primaryLawyer === null ? (
                "—"
              ) : (
                <>
                  {/* A dash means "nobody accountable". A service whose lawyer
                      we cannot read must not borrow that dash and claim to be
                      unassigned. */}
                  {service.primaryLawyer.fullName ?? (
                    <span className="text-inkMute">{t("service.nameUnavailable")}</span>
                  )}
                  {service.coverLawyers.length > 0 && (
                    <span className="text-inkMute">
                      {" "}
                      {t("service.coverExtraShort", { count: service.coverLawyers.length })}
                    </span>
                  )}
                </>
              )}
            </TableCell>
            <TableCell align="num">
              {service.currentVersion?.priceMinor != null && service.currentVersion.currency != null
                ? formatMoney(
                    service.currentVersion.priceMinor,
                    service.currentVersion.currency,
                    intlLocale,
                  )
                : "—"}
            </TableCell>
            <TableCell align="num">
              {service.currentVersion
                ? t("service.versionShort", { version: service.currentVersion.version })
                : "—"}
            </TableCell>
            <TableCell align="center">
              {service.currentVersion ? (
                <Badge tone={statusTone[service.currentVersion.status]}>
                  {t(serviceStatusKey[service.currentVersion.status])}
                </Badge>
              ) : (
                <span className="text-inkMute">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}

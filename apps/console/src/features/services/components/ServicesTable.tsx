// The dense rendering. Better than any grid at forty rows, which is why it
// stays rather than being replaced by the cards (§4.1).
//
// It renders rows and nothing else: loading, the three emptinesses and the
// errors belong to the page, because they are the same regardless of which
// rendering the reader picked.

import { Badge, Table, TableCell, TableHead, TableRow } from "@legal-ai/ui";
import { Link } from "react-router";
import { formatMoney } from "../../../shared/format";
import type { ServiceListItem } from "../api";
import { statusTone } from "./statusTone";

export function ServicesTable({ services }: { services: ServiceListItem[] }) {
  return (
    <Table>
      <TableHead>
        <tr>
          <th>Service</th>
          <th>Area</th>
          <th>Mode</th>
          <th>Review</th>
          <th>Lawyer</th>
          <th>Price</th>
          <th>Version</th>
          <th>Status</th>
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
            <TableCell>{service.practiceArea.label}</TableCell>
            <TableCell>{service.currentVersion?.generationMode ?? "—"}</TableCell>
            <TableCell>{service.currentVersion?.reviewMode ?? "—"}</TableCell>
            <TableCell>
              {service.primaryLawyer === null ? (
                "—"
              ) : (
                <>
                  {/* A dash means "nobody accountable". A service whose lawyer
                      we cannot read must not borrow that dash and claim to be
                      unassigned. */}
                  {service.primaryLawyer.fullName ?? (
                    <span className="text-inkMute">name unavailable</span>
                  )}
                  {service.coverLawyers.length > 0 && (
                    <span className="text-inkMute"> +{service.coverLawyers.length}</span>
                  )}
                </>
              )}
            </TableCell>
            <TableCell align="num">
              {service.currentVersion?.priceMinor != null && service.currentVersion.currency != null
                ? formatMoney(service.currentVersion.priceMinor, service.currentVersion.currency)
                : "—"}
            </TableCell>
            <TableCell align="num">
              {service.currentVersion ? `v${service.currentVersion.version}` : "—"}
            </TableCell>
            <TableCell align="center">
              {service.currentVersion ? (
                <Badge tone={statusTone[service.currentVersion.status]}>
                  {service.currentVersion.status}
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

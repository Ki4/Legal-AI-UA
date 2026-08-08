import type { ServiceStatus } from "@legal-ai/db";
import {
  Badge,
  EmptyState,
  Spinner,
  Table,
  TableCell,
  TableHead,
  TableRow,
  type BadgeTone,
} from "@legal-ai/ui";
import { Link } from "react-router";
import { formatMoney } from "../../../shared/format";
import { useServices } from "../hooks/useServices";

const statusTone: Record<ServiceStatus, BadgeTone> = {
  published: "ok",
  draft: "neutral",
  in_review: "neutral",
  paused: "warn",
  archived: "neutral",
};

const COLUMN_COUNT = 7;

export function ServicesListPage() {
  const { services, loading, error } = useServices();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Services</h1>
      <p className="text-sm text-inkSoft">
        Served by this feature&apos;s <code>api/</code> layer. It reads fixtures today and Supabase
        later; no component on this screen changes when that happens.
      </p>

      {error !== null && <p className="text-sm text-danger-ink">{error}</p>}

      <Table>
        <TableHead>
          <tr>
            <th>Service</th>
            <th>Mode</th>
            <th>Review</th>
            <th>Lawyer</th>
            <th>Price</th>
            <th>Version</th>
            <th>Status</th>
          </tr>
        </TableHead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={COLUMN_COUNT}>
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              </td>
            </tr>
          ) : services.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT}>
                {error === null ? (
                  <EmptyState
                    title="No services yet"
                    hint="Create the first one — it takes minutes"
                  />
                ) : (
                  // An empty list after a failed load is not an empty
                  // catalogue. Telling an admin to create their first service
                  // when the fetch simply broke is worse than saying nothing.
                  <EmptyState title="Could not load the catalogue" hint="Try again in a moment" />
                )}
              </td>
            </tr>
          ) : (
            services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <Link to={`/services/${service.id}`} className="font-medium hover:underline">
                    {service.title}
                  </Link>
                </TableCell>
                <TableCell>{service.currentVersion?.generationMode ?? "—"}</TableCell>
                <TableCell>{service.currentVersion?.reviewMode ?? "—"}</TableCell>
                <TableCell>
                  {service.assignedLawyer === null
                    ? "—"
                    : // A dash here means "nobody assigned". A service that has a
                      // lawyer whose profile we cannot read must not borrow that
                      // dash and claim to be unassigned.
                      (service.assignedLawyer.fullName ?? (
                        <span className="text-inkMute">name unavailable</span>
                      ))}
                </TableCell>
                <TableCell align="num">
                  {service.currentVersion
                    ? formatMoney(
                        service.currentVersion.priceMinor,
                        service.currentVersion.currency,
                      )
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
            ))
          )}
        </tbody>
      </Table>
    </section>
  );
}

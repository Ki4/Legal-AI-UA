import { mockServices } from "@legal-ai/db";
import type { ServiceStatus } from "@legal-ai/db";
import {
  Badge,
  EmptyState,
  Table,
  TableCell,
  TableHead,
  TableRow,
  type BadgeTone,
} from "@legal-ai/ui";
import { Link } from "react-router";

const statusTone: Record<ServiceStatus, BadgeTone> = {
  published: "ok",
  draft: "neutral",
  in_review: "neutral",
  paused: "warn",
  archived: "neutral",
};

const COLUMN_COUNT = 5;

export function ServicesListPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Services</h1>
      <p className="text-sm text-inkSoft">
        Mock data — this feature's api/ layer switches to Supabase queries without touching
        components.
      </p>
      <Table>
        <TableHead>
          <tr>
            <th>Service</th>
            <th>Mode</th>
            <th>Review</th>
            <th>Price</th>
            <th>Status</th>
          </tr>
        </TableHead>
        <tbody>
          {mockServices.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT}>
                <EmptyState
                  title="No services yet"
                  hint="Create the first one — it takes minutes"
                />
              </td>
            </tr>
          ) : (
            mockServices.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <Link to={`/services/${service.id}`} className="font-medium hover:underline">
                    {service.title}
                  </Link>
                </TableCell>
                <TableCell>{service.generationMode}</TableCell>
                <TableCell>{service.reviewMode}</TableCell>
                <TableCell align="num">€{service.priceEur}</TableCell>
                <TableCell align="center">
                  <Badge tone={statusTone[service.status]}>{service.status}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
    </section>
  );
}

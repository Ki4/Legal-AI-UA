// The card grid — the default rendering, and the one that answers "what is this
// service" without the reader opening it.
//
// Grouped under area headings only while no area is chosen. Once the reader has
// picked one, every card is in it, and a heading above a homogeneous list is
// noise (§4.1).

import { Badge } from "@legal-ai/ui";
import { Link } from "react-router";
import { formatMoney } from "../../../shared/format";
import type { ServiceListItem } from "../api";
import { statusTone } from "./statusTone";

function ServiceCard({ service }: { service: ServiceListItem }) {
  const version = service.currentVersion;

  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/services/${service.id}`} className="font-medium leading-tight hover:underline">
          {service.title}
        </Link>
        {version ? (
          <Badge tone={statusTone[version.status]}>{version.status}</Badge>
        ) : (
          <Badge tone="neutral">no versions</Badge>
        )}
      </div>

      {service.summary !== null && (
        <p className="line-clamp-2 text-sm text-inkSoft">{service.summary}</p>
      )}

      <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-inkMute">Area</dt>
        <dd>{service.practiceArea.label}</dd>

        <dt className="text-inkMute">Accountable</dt>
        <dd>
          {service.primaryLawyer === null ? (
            // A dash means nobody is accountable. A service whose lawyer cannot
            // be read must not borrow it and claim to be unassigned (DoD §5).
            <span className="text-inkMute">nobody</span>
          ) : (
            <>
              {service.primaryLawyer.fullName ?? (
                <span className="text-inkMute">name unavailable</span>
              )}
              {service.coverLawyers.length > 0 && (
                <span className="text-inkMute"> +{service.coverLawyers.length} cover</span>
              )}
            </>
          )}
        </dd>

        <dt className="text-inkMute">Version</dt>
        <dd>{version ? `v${version.version}` : "—"}</dd>

        <dt className="text-inkMute">Price</dt>
        <dd>
          {version?.priceMinor != null && version.currency != null
            ? formatMoney(version.priceMinor, version.currency)
            : "—"}
        </dd>
      </dl>
    </li>
  );
}

function Grid({ services }: { services: ServiceListItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </ul>
  );
}

interface Props {
  services: ServiceListItem[];
  /** True when the reader has narrowed to specific areas, so headings stop earning their place. */
  grouped: boolean;
}

export function ServiceCards({ services, grouped }: Props) {
  if (!grouped) return <Grid services={services} />;

  // The list arrives ordered by area already, so grouping is a walk rather than
  // a sort — and the order of the groups is the reference table's, not this
  // component's opinion.
  const groups: { code: string; label: string; services: ServiceListItem[] }[] = [];
  for (const service of services) {
    const last = groups.at(-1);
    if (last !== undefined && last.code === service.practiceArea.code) {
      last.services.push(service);
    } else {
      groups.push({
        code: service.practiceArea.code,
        label: service.practiceArea.label,
        services: [service],
      });
    }
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.code} className="space-y-2">
          <h2 className="text-sm font-medium text-inkSoft">
            {group.label} <span className="text-inkMute">{group.services.length}</span>
          </h2>
          <Grid services={group.services} />
        </section>
      ))}
    </div>
  );
}

import { Spinner } from "@legal-ai/ui";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { AppError } from "../../../shared/api/errors";
import { formatDate, formatMoney } from "../../../shared/format";
import { serviceDetailApi, type ServiceDetail } from "../api";
import { AssignmentSection } from "./AssignmentSection";

export function ServiceDetailPage() {
  const { serviceId } = useParams();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `loading` starts true, so bailing out without clearing it would leave the
    // page on a spinner forever. Unreachable while the route supplies the
    // param, which is exactly why it would go unnoticed if it ever were not.
    if (serviceId === undefined) {
      setLoading(false);
      setError("No service selected.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    serviceDetailApi
      .get(serviceId)
      .then((result) => {
        if (!cancelled) setService(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof AppError && cause.code === "not_found"
            ? "Service not found."
            : "Could not load this service.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">Loading service</span>
      </div>
    );
  }

  if (error !== null) {
    return <div className="text-inkSoft">{error}</div>;
  }

  if (service === null) {
    return <div className="text-inkSoft">Service not found.</div>;
  }

  const version = service.currentVersion;

  return (
    <section className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{service.title}</h1>
        {service.summary !== null && <p className="mt-1 text-sm text-inkSoft">{service.summary}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-paper p-4 text-sm">
        <dt className="text-inkSoft">Status</dt>
        <dd>{version?.status ?? "no versions yet"}</dd>
        <dt className="text-inkSoft">Current version</dt>
        <dd>{version ? `v${version.version}` : "—"}</dd>
        <dt className="text-inkSoft">Generation mode</dt>
        <dd>{version?.generationMode ?? "—"}</dd>
        <dt className="text-inkSoft">Review mode</dt>
        <dd>{version?.reviewMode ?? "—"}</dd>
        <dt className="text-inkSoft">Price</dt>
        <dd>
          {version?.priceMinor != null && version.currency != null
            ? formatMoney(version.priceMinor, version.currency)
            : "—"}
        </dd>
        <dt className="text-inkSoft">Last changed</dt>
        <dd>{formatDate(service.updatedAt)}</dd>
      </dl>

      {/* Who is assigned used to be one line in the table above. It is a
          section of its own now because it is editable and because there is
          more than one of them: an accountable lawyer and any number of cover. */}
      <AssignmentSection service={service} onChanged={setService} />

      <Link
        to={`/services/${service.id}/anatomy`}
        className="inline-block text-brand hover:underline"
      >
        Document anatomy →
      </Link>
    </section>
  );
}

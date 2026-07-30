import { mockServices } from "@legal-ai/db";
import { Link, useParams } from "react-router";

export function ServiceDetailPage() {
  const { serviceId } = useParams();
  const service = mockServices.find((candidate) => candidate.id === serviceId);

  if (!service) {
    return <div className="text-ink-muted">Service not found.</div>;
  }

  return (
    <section className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{service.title}</h1>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
        <dt className="text-ink-muted">Status</dt>
        <dd>{service.status}</dd>
        <dt className="text-ink-muted">Generation mode</dt>
        <dd>{service.generationMode}</dd>
        <dt className="text-ink-muted">Review mode</dt>
        <dd>{service.reviewMode}</dd>
        <dt className="text-ink-muted">Price</dt>
        <dd>€{service.priceEur}</dd>
      </dl>
      <Link
        to={`/services/${service.id}/anatomy`}
        className="inline-block text-accent hover:underline"
      >
        Document anatomy →
      </Link>
    </section>
  );
}

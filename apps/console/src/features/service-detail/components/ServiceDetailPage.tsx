import { mockServices } from "@legal-ai/db";
import { Link, useParams } from "react-router";

export function ServiceDetailPage() {
  const { serviceId } = useParams();
  const service = mockServices.find((candidate) => candidate.id === serviceId);

  if (!service) {
    return <div className="text-inkSoft">Service not found.</div>;
  }

  return (
    <section className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{service.title}</h1>
      <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-paper p-4 text-sm">
        <dt className="text-inkSoft">Status</dt>
        <dd>{service.status}</dd>
        <dt className="text-inkSoft">Generation mode</dt>
        <dd>{service.generationMode}</dd>
        <dt className="text-inkSoft">Review mode</dt>
        <dd>{service.reviewMode}</dd>
        <dt className="text-inkSoft">Price</dt>
        <dd>€{service.priceEur}</dd>
      </dl>
      <Link
        to={`/services/${service.id}/anatomy`}
        className="inline-block text-brand hover:underline"
      >
        Document anatomy →
      </Link>
    </section>
  );
}

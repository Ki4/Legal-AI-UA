import { mockServices } from "@legal-ai/db";
import { Link } from "react-router";

export function ServicesListPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Services</h1>
      <p className="text-sm text-ink-muted">
        Mock data — this feature's api/ layer switches to Supabase queries without touching
        components.
      </p>
      <ul className="grid max-w-3xl gap-3">
        {mockServices.map((service) => (
          <li key={service.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <Link to={`/services/${service.id}`} className="font-medium hover:underline">
                {service.title}
              </Link>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                {service.status}
              </span>
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              {service.generationMode} · {service.reviewMode} · €{service.priceEur}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

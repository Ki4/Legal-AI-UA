import { useI18n } from "@legal-ai/i18n";
import { Badge, Button, EmptyState, Spinner } from "@legal-ai/ui";
import { Link, useParams } from "react-router";
import { formatDate, formatDateTime } from "../../../shared/format";
import {
  generationModeKey,
  orderStatusKey,
  reviewModeKey,
  serviceStatusKey,
} from "../../../shared/vocabulary";
import type { OrderEntitlement, OrderReviewer, PinnedVersion } from "../api";
import { useOrderCard } from "../hooks/useOrderCard";
import { OrderTimeline } from "./OrderTimeline";
import { statusTone } from "./statusTone";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-inkMute">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

function Reviewer({ reviewer }: { reviewer: OrderReviewer }) {
  const { t } = useI18n();

  if (reviewer.kind === "person") return <>{reviewer.fullName}</>;

  return (
    <span className="text-inkMute">
      {t(reviewer.kind === "none" ? "orders.reviewer.none" : "orders.reviewer.unnamed")}
    </span>
  );
}

function Entitlement({ entitlement }: { entitlement: OrderEntitlement }) {
  const { t, intlLocale } = useI18n();

  // Three states, and the middle one is ADR-0019 arriving on a screen. A lawyer
  // reads `entitlement_id` because it is a column of `orders`, and cannot read
  // the row it points at because that is administration. Rendering that as
  // "nothing bought" would be telling them something false about an order that
  // has been paid for.
  if (entitlement.kind === "none") {
    return <span className="text-inkMute">{t("order.entitlement.none")}</span>;
  }

  if (entitlement.kind === "withheld") {
    return <span className="text-inkMute">{t("order.entitlement.withheld")}</span>;
  }

  return (
    <div className="space-y-1">
      <div>
        {t(
          entitlement.entitlementKind === "one_off"
            ? "order.entitlement.oneOff"
            : "order.entitlement.subscription",
        )}
      </div>
      {entitlement.revokedAt !== null ? (
        // A withdrawn purchase, which is not the same fact as a lapsed term —
        // that is the whole reason `revoked_at` is its own column (§8.6).
        <Badge tone="danger">{t("order.entitlement.revoked")}</Badge>
      ) : entitlement.validUntil !== null ? (
        <span className="text-xs text-inkSoft">
          {t("order.entitlement.until")} {formatDate(entitlement.validUntil, intlLocale)}
        </span>
      ) : (
        // §8.1: a one-off was sold on "valid until the law changes", so it has
        // no date to show and the absence is the answer rather than a gap.
        <span className="text-xs text-inkSoft">{t("order.entitlement.untilLawChanges")}</span>
      )}
    </div>
  );
}

function Pinned({ pinned }: { pinned: PinnedVersion }) {
  const { t } = useI18n();

  return (
    <div className="rounded-card border border-line bg-paperAlt p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/services/${pinned.serviceId}`} className="text-brand hover:underline">
          {/* check-copy-ignore: a service title is data an admin typed */}
          {pinned.serviceTitle}
        </Link>
        {/* check-copy-ignore: a version number is data */}
        <span className="text-inkSoft">v{pinned.version}</span>
        <Badge tone="neutral">{t(serviceStatusKey[pinned.status])}</Badge>
        {pinned.frozen && (
          // The half of §5.4 that makes the other half mean anything: a version
          // id proves nothing about what a document was made of unless what
          // sits behind it can no longer change.
          <Badge tone="ok">{t("order.pinned.frozen")}</Badge>
        )}
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={t("service.field.generationMode")}>
          {t(generationModeKey[pinned.generationMode])}
        </Field>
        <Field label={t("service.field.reviewMode")}>{t(reviewModeKey[pinned.reviewMode])}</Field>
      </dl>

      <p className="mt-3 text-xs text-inkSoft">{t("order.pinned.hint")}</p>
    </div>
  );
}

export function OrderCardPage() {
  const { orderId } = useParams();
  const { t, intlLocale } = useI18n();
  const { order, loading, errorKey, retryable, reload } = useOrderCard(orderId);

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">{t("order.loading")}</span>
      </div>
    );
  }

  if (errorKey !== null) {
    return (
      <section className="space-y-4">
        <Link to="/orders" className="text-sm text-brand hover:underline">
          {t("order.backToList")}
        </Link>

        {retryable ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-danger-ink">{t(errorKey)}</p>
            <Button variant="secondary" onClick={reload}>
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : (
          // A mistyped id, or an order that is not this reader's — one sentence
          // for both, on purpose (§7.3). It ends in no invitation to retry,
          // because there is no button beside it.
          <EmptyState title={t(errorKey)} hint={t("order.gone.hint")} />
        )}
      </section>
    );
  }

  if (order === null) return null;

  return (
    <section className="space-y-6">
      <div>
        <Link to="/orders" className="text-sm text-brand hover:underline">
          {t("order.backToList")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {/* check-copy-ignore: a client pseudonym is data, generated by the database */}
          {order.clientPseudonym}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(order.status)}>{t(orderStatusKey[order.status])}</Badge>
          {order.humanReviewRequested && <Badge tone="warn">{t("orders.humanReview")}</Badge>}
        </div>
      </div>

      <Pinned pinned={order.pinned} />

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("orders.field.reviewer")}>
          <Reviewer reviewer={order.reviewer} />
        </Field>
        <Field label={t("order.field.entitlement")}>
          <Entitlement entitlement={order.entitlement} />
        </Field>
        <Field label={t("orders.field.placed")}>{formatDateTime(order.placedAt, intlLocale)}</Field>
        <Field label={t("order.field.ended")}>
          {order.deliveredAt !== null ? (
            formatDateTime(order.deliveredAt, intlLocale)
          ) : order.closedAt !== null ? (
            formatDateTime(order.closedAt, intlLocale)
          ) : (
            <span className="text-inkMute">{t("order.field.stillOpen")}</span>
          )}
        </Field>
      </dl>

      <div>
        <h2 className="text-lg font-semibold">{t("order.timeline.title")}</h2>
        <p className="mt-1 text-sm text-inkSoft">{t("order.timeline.subtitle")}</p>

        <div className="mt-3">
          {order.timeline.length === 0 ? (
            <EmptyState
              title={t("order.timeline.empty.title")}
              hint={t("order.timeline.empty.hint")}
            />
          ) : (
            <OrderTimeline events={order.timeline} />
          )}
        </div>
      </div>
    </section>
  );
}

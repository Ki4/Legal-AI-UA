// One service's law dependencies (§4.9), and the form that adds them.

import { useI18n } from "@legal-ai/i18n";
import { Badge, Button, EmptyState, Spinner } from "@legal-ai/ui";
import { useParams } from "react-router";
import { lawNormStateKey } from "../../../shared/vocabulary";
import { useServiceLaw } from "../hooks/useServiceLaw";
import type { ServiceLawRef } from "../api";
import { AddReferenceForm } from "./AddReferenceForm";
import { cadencePhrase } from "./cadence";
import { Freshness } from "./NormsTable";
import { normStateTone } from "./tone";

function Reference({
  reference,
  removing,
  onRemove,
}: {
  reference: ServiceLawRef;
  removing: boolean;
  onRemove: () => void;
}) {
  const { t, tCount } = useI18n();
  const { norm } = reference;
  const cadence = cadencePhrase(norm.probeIntervalHours);

  // This service is one of them, so the count a reader cares about is the rest.
  const others = Math.max(norm.dependents.length - 1, 0);

  return (
    <li className="space-y-2 rounded-card border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* check-copy-ignore: an act title is data a lawyer typed */}
        <span className="font-medium">{norm.actTitle}</span>
        {norm.article === null ? (
          <Badge tone="warn">{t("law.wholeAct")}</Badge>
        ) : (
          // check-copy-ignore: an article number is data
          <span className="text-inkSoft">{norm.article}</span>
        )}
        <Badge tone={normStateTone(norm.state)}>{t(lawNormStateKey[norm.state])}</Badge>
        <Freshness freshness={norm.freshness} />
      </div>

      {/* §9.5.6, and the reason the column is `not null`: this is the sentence
          that tells whoever meets a diff in six months whether it matters. */}
      <p className="text-sm">
        <span className="text-inkMute">{t("serviceLaw.reliedOn")}</span>{" "}
        {/* check-copy-ignore: a lawyer's own sentence about the dependency */}
        {reference.reliedOn}
      </p>

      {norm.actScopeReason !== null && (
        <p className="text-sm">
          <span className="text-inkMute">{t("law.wholeActReason")}</span>{" "}
          {/* check-copy-ignore: a lawyer's own reason for act-level tracking */}
          {norm.actScopeReason}
        </p>
      )}

      <p className="text-sm text-inkSoft">{tCount(cadence.key, cadence.count)}</p>

      {others > 0 && (
        // §9.3 made visible where it matters most: a lawyer about to drop this
        // reference, or to ask for the cadence to change, can see the norm is
        // not theirs alone.
        <p className="text-sm text-inkSoft">{tCount("serviceLaw.alsoRelied", others)}</p>
      )}

      <div className="flex items-center gap-3">
        <a
          href={norm.canonicalUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-brand hover:underline"
        >
          {t("law.openSource")}
        </a>
        <Button variant="secondary" onClick={onRemove} disabled={removing}>
          {t(removing ? "serviceLaw.removing" : "serviceLaw.remove")}
        </Button>
      </div>
    </li>
  );
}

export function ServiceLawPage() {
  const { serviceId } = useParams();
  const { t } = useI18n();
  const {
    page,
    loading,
    notFound,
    errorKey,
    adding,
    addErrorKey,
    checking,
    check,
    checkErrorKey,
    addOutcome,
    removingId,
    removeErrorKey,
    checkArticle,
    addReference,
    removeReference,
    reload,
  } = useServiceLaw(serviceId ?? "");

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">{t("serviceLaw.loading")}</span>
      </div>
    );
  }

  // A mistyped id and a broken request call for different reactions, so they get
  // different screens (DoD §4).
  if (notFound) {
    return (
      <EmptyState title={t("serviceLaw.notFound.title")} hint={t("serviceLaw.notFound.hint")} />
    );
  }

  if (errorKey !== null) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-danger-ink">{t(errorKey)}</p>
          <Button variant="secondary" onClick={reload}>
            {t("common.tryAgain")}
          </Button>
        </div>
        {/* Not the empty state. "No norms recorded yet" beside a failed request
            tells a lawyer their service rests on nothing. */}
        <EmptyState title={t("serviceLaw.failed.title")} hint={t("serviceLaw.failed.hint")} />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("serviceLaw.title")}</h1>
        {/* check-copy-ignore: a service title is data an admin typed */}
        <p className="mt-1 text-sm text-inkSoft">{page?.serviceTitle}</p>
        <p className="mt-1 text-sm text-inkSoft">{t("serviceLaw.subtitle")}</p>
      </div>

      {page === null || page.refs.length === 0 ? (
        <EmptyState title={t("serviceLaw.empty.title")} hint={t("serviceLaw.empty.hint")} />
      ) : (
        <ul className="space-y-3">
          {page.refs.map((reference) => (
            <Reference
              key={reference.id}
              reference={reference}
              removing={removingId === reference.id}
              onRemove={() => void removeReference(reference.id)}
            />
          ))}
        </ul>
      )}

      {removeErrorKey !== null && <p className="text-sm text-danger-ink">{t(removeErrorKey)}</p>}

      <AddReferenceForm
        serviceId={serviceId ?? ""}
        adding={adding}
        errorKey={addErrorKey}
        checking={checking}
        check={check}
        checkErrorKey={checkErrorKey}
        addOutcome={addOutcome}
        onCheck={checkArticle}
        onAdd={addReference}
      />
    </section>
  );
}

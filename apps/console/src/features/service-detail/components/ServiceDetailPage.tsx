import { useI18n, type TranslationKey } from "@legal-ai/i18n";
import { Spinner } from "@legal-ai/ui";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { AppError } from "../../../shared/api/errors";
import { formatDate, formatMoney } from "../../../shared/format";
import { generationModeKey, reviewModeKey, serviceStatusKey } from "../../../shared/vocabulary";
import { serviceDetailApi, type ServiceDetail } from "../api";
import { AssignmentSection } from "./AssignmentSection";

export function ServiceDetailPage() {
  const { serviceId } = useParams();
  const { t, intlLocale } = useI18n();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // The key rather than the sentence, so switching language re-renders the
  // failure in the new one instead of leaving it in whichever was active when
  // the request failed.
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    // `loading` starts true, so bailing out without clearing it would leave the
    // page on a spinner forever. Unreachable while the route supplies the
    // param, which is exactly why it would go unnoticed if it ever were not.
    if (serviceId === undefined) {
      setLoading(false);
      setErrorKey("card.error.noneSelected");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorKey(null);

    serviceDetailApi
      .get(serviceId)
      .then((result) => {
        if (!cancelled) setService(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setErrorKey(
          cause instanceof AppError && cause.code === "not_found"
            ? "card.error.notFound"
            : "card.error.load",
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
        <span className="sr-only">{t("card.loading")}</span>
      </div>
    );
  }

  if (errorKey !== null) {
    return <div className="text-inkSoft">{t(errorKey)}</div>;
  }

  if (service === null) {
    return <div className="text-inkSoft">{t("card.error.notFound")}</div>;
  }

  const version = service.currentVersion;

  return (
    <section className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{service.title}</h1>
        {service.summary !== null && <p className="mt-1 text-sm text-inkSoft">{service.summary}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-paper p-4 text-sm">
        <dt className="text-inkSoft">{t("service.field.status")}</dt>
        <dd>{version ? t(serviceStatusKey[version.status]) : t("service.noVersionsYet")}</dd>
        <dt className="text-inkSoft">{t("service.field.currentVersion")}</dt>
        <dd>{version ? t("service.versionShort", { version: version.version }) : "—"}</dd>
        <dt className="text-inkSoft">{t("service.field.generationMode")}</dt>
        <dd>{version ? t(generationModeKey[version.generationMode]) : "—"}</dd>
        <dt className="text-inkSoft">{t("service.field.reviewMode")}</dt>
        <dd>{version ? t(reviewModeKey[version.reviewMode]) : "—"}</dd>
        <dt className="text-inkSoft">{t("service.field.price")}</dt>
        <dd>
          {version?.priceMinor != null && version.currency != null
            ? formatMoney(version.priceMinor, version.currency, intlLocale)
            : "—"}
        </dd>
        <dt className="text-inkSoft">{t("service.field.lastChanged")}</dt>
        <dd>{formatDate(service.updatedAt, intlLocale)}</dd>
      </dl>

      {/* Who is assigned used to be one line in the table above. It is a
          section of its own now because it is editable and because there is
          more than one of them: an accountable lawyer and any number of cover. */}
      <AssignmentSection service={service} onChanged={setService} />

      {/* Links, not imports: the two screens behind them are separate features
          and stay that way (DoD §1). What crosses here is a URL. */}
      <div className="flex gap-4">
        <Link to={`/services/${service.id}/fields`} className="text-brand hover:underline">
          {t("card.fields")}
        </Link>
        <Link to={`/services/${service.id}/anatomy`} className="text-brand hover:underline">
          {t("card.anatomy")}
        </Link>
        <Link to={`/services/${service.id}/history`} className="text-brand hover:underline">
          {t("card.history")}
        </Link>
        <Link to={`/services/${service.id}/law`} className="text-brand hover:underline">
          {t("card.law")}
        </Link>
      </div>
    </section>
  );
}

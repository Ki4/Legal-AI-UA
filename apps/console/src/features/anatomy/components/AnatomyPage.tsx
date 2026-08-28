import { useI18n, type TranslationKey } from "@legal-ai/i18n";
import { Citation, Confidence, Provenance, Spinner, type ProvenanceState } from "@legal-ai/ui";
import { useParams } from "react-router";
import type { BlockTrust } from "../api";
import { useTrace } from "../hooks/useTrace";

// Two answers to one value, kept side by side because they are read together:
// which badge a block gets, and which sentence that badge says. `Provenance`
// and `Confidence` carry English defaults for the design-system gallery, so a
// screen a lawyer reads passes its own `label` — the components' escape hatch
// exists for exactly this. What the words should *be* for `template` is a
// separate, still-open question (STATE, the anatomy findings); this map
// carries the wording that was already on screen, in both languages.
const trustBadge: Record<BlockTrust, { state: ProvenanceState; key: TranslationKey }> = {
  template: { state: "confirmed", key: "anatomy.trust.template" },
  ai_generated: { state: "ai", key: "anatomy.trust.ai_generated" },
  lawyer_edited: { state: "edited", key: "anatomy.trust.lawyer_edited" },
};

export function AnatomyPage() {
  const { serviceId } = useParams();
  const { t } = useI18n();
  const { trace, loading, errorKey } = useTrace(serviceId);

  return (
    <section className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("anatomy.title")}</h1>
      <p className="text-sm text-inkSoft">{t("anatomy.subtitle", { service: serviceId ?? "" })}</p>
      {loading ? (
        // Spinner is aria-hidden by design, so the wrapper carries the
        // announcement — otherwise a screen reader hears nothing at all.
        <div className="flex justify-center py-12" role="status" aria-live="polite">
          <Spinner />
          <span className="sr-only">{t("anatomy.loading")}</span>
        </div>
      ) : errorKey !== null ? (
        <p className="text-sm text-danger-ink">{t(errorKey)}</p>
      ) : trace === null || trace.blocks.length === 0 ? (
        // Empty and failed do not share a rendering (DoD §4): a trace with no
        // blocks is a document nobody has generated yet, which is not a fault
        // and reads nothing like one.
        <p className="text-sm text-inkMute">{t("anatomy.empty")}</p>
      ) : (
        <ol className="space-y-3">
          {trace.blocks.map((block) => (
            <li
              key={block.id}
              className={`rounded-card border bg-paper p-4 ${
                block.needsAttention ? "border-danger" : "border-line"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{block.title}</span>
                <div className="flex items-center gap-2">
                  <Confidence
                    level={block.needsAttention ? "needs-review" : "high"}
                    label={t("anatomy.needsReview")}
                  />
                  <Provenance
                    state={trustBadge[block.trust].state}
                    label={t(trustBadge[block.trust].key)}
                  />
                </div>
              </div>
              {block.lawRefs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {/* `{actTitle} {article}`, the same way CadenceEditor and NormsTable
                      render a norm — one appearance per norm across the console. An
                      act-scoped ref has no article and is just the title. */}
                  {block.lawRefs.map((ref) => (
                    <Citation
                      key={ref.normId}
                      source={`${ref.actTitle} ${ref.article ?? ""}`.trimEnd()}
                    />
                  ))}
                </div>
              )}
              {block.questionnaireFields.length > 0 && (
                <p className="mt-2 text-sm text-inkMute">
                  {t("anatomy.questionnaireFields", {
                    fields: block.questionnaireFields.join(", "),
                  })}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

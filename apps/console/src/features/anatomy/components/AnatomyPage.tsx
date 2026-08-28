import { useI18n, type TranslationKey } from "@legal-ai/i18n";
import {
  Badge,
  Citation,
  Confidence,
  Provenance,
  Spinner,
  type ProvenanceState,
} from "@legal-ai/ui";
import { useParams } from "react-router";
import type { BlockTrust, ToolOutcome } from "../api";
import { useTrace } from "../hooks/useTrace";

// Two answers to one value, kept side by side because they are read together:
// which marker a block gets, and which sentence that marker says. `Provenance`
// and `Confidence` carry English defaults for the design-system gallery, so a
// screen a lawyer reads passes its own `label` — the components' escape hatch
// exists for exactly this.
//
// **`template` keeps the `confirmed` marker and loses the word "confirmed",
// and the split is the point.** `BlockTrust` answers who wrote the text — the
// schema says so — and a template block's text was written by a lawyer, which
// is what the solid green marker is for. Design-system §8.1 gives that marker a
// second meaning: a block flips to `confirmed` when a lawyer approves it. This
// screen had been printing that approval for documents nobody had read. The
// approval axis does not exist in the trace at all, so the honest screen states
// the axis it has and stays silent about the one it does not.
const trustBadge: Record<BlockTrust, { state: ProvenanceState; key: TranslationKey }> = {
  template: { state: "confirmed", key: "anatomy.trust.template" },
  ai_generated: { state: "ai", key: "anatomy.trust.ai_generated" },
  lawyer_edited: { state: "edited", key: "anatomy.trust.lawyer_edited" },
};

// A failed call is the reason this list is on screen rather than in a log: a
// block produced after a tool errored is a block a lawyer reads differently.
const outcomeBadge: Record<ToolOutcome, { tone: "ok" | "danger"; key: TranslationKey }> = {
  ok: { tone: "ok", key: "anatomy.toolCall.ok" },
  error: { tone: "danger", key: "anatomy.toolCall.error" },
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
              {/* Why the block is here at all. A null condition is rendered as
                  its own sentence rather than as nothing: "unconditional" and
                  "we did not show you the condition" look identical when the
                  absence is silent. */}
              <p className="mt-2 text-sm text-inkMute">
                {block.selectedBy === null
                  ? t("anatomy.selectedBy.unconditional")
                  : t("anatomy.selectedBy", { expression: block.selectedBy.expression })}
              </p>
              {block.selectedBy !== null && block.selectedBy.fieldKeys.length > 0 && (
                <p className="mt-1 text-sm text-inkMute">
                  {t("anatomy.selectedBy.fields", {
                    fields: block.selectedBy.fieldKeys.join(", "),
                  })}
                </p>
              )}
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
              {block.toolCalls.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-inkMute">{t("anatomy.toolCalls")}</p>
                  {/* An ordered list, because the order is the whole of what a
                      retried call tells a reader — see `ToolCallView`, which is
                      why no timestamp is rendered beside it. */}
                  <ol className="mt-1 flex flex-wrap gap-1.5">
                    {block.toolCalls.map((call, index) => (
                      // The index belongs in the key here: one tool called
                      // twice — the retry — is two entries whose every field
                      // matches, and their position is the only thing that
                      // tells them apart.
                      <li key={`${call.tool}-${index}`} className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-inkSoft">{call.tool}</span>
                        <Badge tone={outcomeBadge[call.outcome].tone}>
                          {t(outcomeBadge[call.outcome].key)}
                        </Badge>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

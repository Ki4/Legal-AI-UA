import { Citation, Confidence, Provenance, Spinner, type ProvenanceState } from "@legal-ai/ui";
import { useParams } from "react-router";
import type { BlockTrust } from "../api";
import { useTrace } from "../hooks/useTrace";

const provenanceState: Record<BlockTrust, ProvenanceState> = {
  template: "confirmed",
  ai_generated: "ai",
  lawyer_edited: "edited",
};

export function AnatomyPage() {
  const { serviceId } = useParams();
  const { trace, loading, error } = useTrace(serviceId);

  return (
    <section className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Document anatomy</h1>
      <p className="text-sm text-inkSoft">
        Service {serviceId} — rendered from a mock generation trace. The real trace arrives from the
        core over the same contract; this UI does not change.
      </p>
      {loading ? (
        // Spinner is aria-hidden by design, so the wrapper carries the
        // announcement — otherwise a screen reader hears nothing at all.
        <div className="flex justify-center py-12" role="status" aria-live="polite">
          <Spinner />
          <span className="sr-only">Loading the generation trace…</span>
        </div>
      ) : error !== null ? (
        <p className="text-sm text-danger-ink">{error}</p>
      ) : trace !== null ? (
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
                  <Confidence level={block.needsAttention ? "needs-review" : "high"} />
                  <Provenance state={provenanceState[block.trust]} />
                </div>
              </div>
              {block.lawRefs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {block.lawRefs.map((ref) => (
                    <Citation key={ref} source={ref} />
                  ))}
                </div>
              )}
              {block.questionnaireFields.length > 0 && (
                <p className="mt-2 text-sm text-inkMute">
                  Questionnaire fields: {block.questionnaireFields.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

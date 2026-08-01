import { mockTrace, type BlockTrust } from "@legal-ai/db";
import { Citation, Confidence, Provenance, type ProvenanceState } from "@legal-ai/ui";
import { useParams } from "react-router";

const provenanceState: Record<BlockTrust, ProvenanceState> = {
  template: "confirmed",
  ai_generated: "ai",
  lawyer_edited: "edited",
};

export function AnatomyPage() {
  const { serviceId } = useParams();

  return (
    <section className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Document anatomy</h1>
      <p className="text-sm text-inkSoft">
        Service {serviceId} — rendered from a mock generation trace. The real trace arrives from the
        core over the same contract; this UI does not change.
      </p>
      <ol className="space-y-3">
        {mockTrace.blocks.map((block) => (
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
    </section>
  );
}

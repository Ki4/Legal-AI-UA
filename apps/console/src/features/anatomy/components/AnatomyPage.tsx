import { mockTrace, type BlockTrust } from "@legal-ai/db";
import { useParams } from "react-router";

const trustLabel: Record<BlockTrust, string> = {
  template: "Template",
  ai_generated: "AI generated",
  lawyer_edited: "Lawyer edited",
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
            <div className="flex items-center justify-between">
              <span className="font-medium">{block.title}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-inkSoft">
                {trustLabel[block.trust]}
              </span>
            </div>
            {block.needsAttention && (
              <p className="mt-2 text-sm text-danger">Needs lawyer attention</p>
            )}
            {block.lawRefs.length > 0 && (
              <p className="mt-2 text-sm text-inkMute">Law refs: {block.lawRefs.join("; ")}</p>
            )}
            {block.questionnaireFields.length > 0 && (
              <p className="mt-1 text-sm text-inkMute">
                Questionnaire fields: {block.questionnaireFields.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

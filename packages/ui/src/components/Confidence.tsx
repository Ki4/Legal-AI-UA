import { Badge } from "./Badge";

export type ConfidenceLevel = "high" | "needs-review";

export interface ConfidenceProps {
  level: ConfidenceLevel;
  /** Overrides the default "Worth checking" copy for needs-review. */
  label?: string;
}

/** §8.2 — two states only, never a fake percentage. "high" renders nothing:
 * quiet is the signal of confidence. "needs-review" is a warn Badge. */
export function Confidence({ level, label }: ConfidenceProps) {
  if (level === "high") return null;
  return <Badge tone="warn">{label ?? "Worth checking"}</Badge>;
}

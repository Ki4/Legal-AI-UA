// One mapping from a service status to a Badge tone, shared by the two
// renderings of the catalogue.
//
// It lives in its own module rather than in either component because a card and
// a table row saying different colours for `paused` would be a bug nobody
// notices until the two are on screen together (design spec: status colour only
// through `Badge tone`, never hand-written).

import type { ServiceStatus } from "@legal-ai/db";
import type { BadgeTone } from "@legal-ai/ui";

export const statusTone: Record<ServiceStatus, BadgeTone> = {
  published: "ok",
  draft: "neutral",
  in_review: "neutral",
  paused: "warn",
  archived: "neutral",
};

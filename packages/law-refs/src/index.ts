// Law-reference normalization: the one definition of what the platform tracks.
//
// **Why this is a package of its own, and why it has no dependencies.** The
// article fetcher is a Deno edge function (ADR-0020), and it must agree with
// the console about what a link means down to the last character — a fetcher
// watching `zakon2.rada.gov.ua/laws/show/2947-14/ed20240101` while the register
// holds `zakon.rada.gov.ua/laws/show/2947-14` is two answers to one question,
// and the disagreement would surface as a norm that never drifts. So the code
// is written once and imported by both.
//
// That is also the entire reason for the shape of this package: no npm
// dependencies, no Node built-ins, nothing generated, and explicit `.ts`
// extensions on internal imports, because Deno resolves none of it implicitly.
// `packages/db` could not host this — it imports the generated Supabase types.
//
// Keep it pure. The moment something here needs the network or the database, it
// belongs on one side of the boundary rather than in the middle of it.

export { normalizeLawLink } from "./link.ts";
export { normalizeArticle } from "./article.ts";
export { decideProbe } from "./probe.ts";
export { extractArticle, extractRedactionDate, printUrl } from "./rada.ts";
export type { RadaDate, RadaExtraction } from "./rada.ts";
export { decideTriage } from "./triage.ts";
export { ARTICLE_FUNCTION } from "./wire.ts";
export type {
  ArticleFailure,
  ArticleObserveRequest,
  ArticleObserveResponse,
  ArticleOutcome,
  ArticlePreviewRequest,
  ArticlePreviewResponse,
  ArticleReading,
  ArticleRequest,
  ArticleResponse,
} from "./wire.ts";
export {
  fingerprintArticleText,
  fingerprintRevision,
  MIN_PLAUSIBLE_ARTICLE_LENGTH,
  NORMALIZER_VERSION,
  normalizeArticleText,
} from "./text.ts";
export type {
  IntakeNotice,
  NotifiedParty,
  NotifyWhen,
  OwedNotification,
  TriageChoice,
  TriageDecision,
  TriagedSignal,
  TriageInput,
  TriageRejection,
  TriageResult,
} from "./triage.ts";
export type { ProbeDecision, ProbedNorm, ProbeInput, ProbeOutcome, ProbeVerdict } from "./probe.ts";
export type {
  ArticleRejection,
  ArticleResult,
  ArticleRevision,
  ArticleRevisionResult,
  ArticleTextRejection,
  ArticleTextResult,
  LawLinkRejection,
  LawLinkResult,
  LawNormState,
  LawSource,
  NormalizedLawLink,
  ProbeFailure,
  RevisionOrigin,
} from "./types.ts";

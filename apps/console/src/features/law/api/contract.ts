// The contract. One implementation runs on fixtures, another on Postgres, and
// both are typed as `LawApi` so a drifting implementation fails to compile
// rather than failing in a browser (ADR-0012).

import type { ArticleObserveResponse, ArticlePreviewResponse } from "@legal-ai/law-refs";
import type {
  CadenceChange,
  LawNormListItem,
  NewLawReference,
  ServiceLawPage,
  ServiceLawRef,
} from "./types";

export interface LawApi {
  /**
   * The whole register (§4.11), newest first.
   *
   * No filter argument and no service parameter, unlike a per-service screen:
   * `law_norms_select_staff` lets both staff roles read every norm, and that is
   * deliberate rather than loose. §4.11 shows a norm *once* with every dependent
   * service listed against it, which is not a screen that can be assembled from
   * rows filtered to the reader's own assignments — and assembling it that way
   * would reintroduce, in the UI, exactly the per-service view of a norm that
   * §9.3 exists to prevent.
   *
   * An empty register is an ordinary answer and the expected one today. Nothing
   * seeds norms; a lawyer enters the first.
   */
  listNorms(): Promise<LawNormListItem[]>;

  /**
   * What one service rests on (§4.9).
   *
   * Throws AppError("not_found") when there is no such service. A service with
   * no dependencies is not that — it is a page with an empty list and an entry
   * form, which is the state every service is in today.
   */
  listForService(serviceId: string): Promise<ServiceLawPage>;

  /**
   * Record that a service relies on a norm, entering the norm if the register
   * does not hold it yet.
   *
   * Two writes behind one operation, and the order matters: the norm is found or
   * created first, because the dependency cannot exist without it. Finding
   * before creating is what makes "watched once" true in practice rather than
   * only in the constraint — a second service citing article 105 attaches to the
   * row the first one entered, and inherits its fingerprint and its cadence.
   *
   * Throws AppError("conflict") when this service already records this norm,
   * and AppError("forbidden") when the caller may not write for this service.
   *
   * **Does not fetch the article back.** `previewArticle` is what checks that
   * the article exists in the act, and it runs *before* this — see the note
   * there for why the order is that way round and not §9.5.7's.
   */
  addReference(input: NewLawReference): Promise<ServiceLawRef>;

  /**
   * Read the article behind a pasted link, and write nothing (§9.6).
   *
   * The screen calls this before it saves, and the reason is the register's
   * shape rather than a preference: `law_norms` grants no delete to anyone, so a
   * norm entered by mistake is a row that stays. §9.5.7 describes the
   * confirmation as following the save, and following the save is also where
   * `observeArticle` runs — but the *first* look has to come before the row
   * exists, or a typo in an article number becomes something the register
   * watches forever and never finds.
   *
   * Resolves with `ok: false` when the source answered and the article was not
   * there: that is an answer, not a failure, and the difference is what lets the
   * form say "this act has no article 900" instead of "something went wrong".
   * Throws AppError only when the call itself did not complete.
   */
  previewArticle(input: { url: string; article: string }): Promise<ArticlePreviewResponse>;

  /**
   * Check a norm that exists, record what was read, and say what moved (§9.7).
   *
   * The console's second call at entry, and the same call ADM-44's scheduler
   * will make on a timer. `confirmedFingerprint` carries the fingerprint of the
   * text a lawyer actually read; when it still matches, the norm becomes
   * `verified` and `last_verified_at` moves — neither of which the console could
   * write for itself, because the grant deliberately withholds those columns
   * (§9.10: a lawyer must not be able to make a norm look freshly checked).
   */
  observeArticle(input: {
    normId: string;
    confirmedFingerprint?: string;
  }): Promise<ArticleObserveResponse>;

  /**
   * Drop a dependency. Returns the id it removed, so a caller that gets a
   * resolved promise knows a row actually went — an RLS `using` denial deletes
   * nothing and reports no error (DoD §3).
   *
   * The norm itself stays. Nothing may delete from the register: it carries the
   * fingerprint history and the audit trail of what a document once rested on,
   * and ADM-24's impact index has to answer for issued documents long after the
   * last service stopped citing it.
   */
  removeReference(refId: string): Promise<string>;

  /**
   * Change how often a norm is probed (§9.8).
   *
   * An operation on the *norm*, not on one service's dependency, and offered
   * from the register rather than from a service's tab for that reason: the
   * cadence is shared by every service resting on the norm, and a control sitting
   * under one service's heading would read as that service's setting — which is
   * the misconception §9.3 is written against.
   *
   * The database refuses a value other than the recommendation without a reason,
   * and refuses one slower than the operating maximum when a published service
   * depends on the norm. Both are `raise exception` in a guard, so both arrive
   * here as AppError("validation").
   */
  setCadence(change: CadenceChange): Promise<LawNormListItem>;
}

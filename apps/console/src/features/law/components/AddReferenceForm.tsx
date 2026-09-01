// Entering a law reference (§9.5), including the step that reads it back.
//
// The form normalizes as the lawyer types and shows back what it resolved — the
// honest half it has always had. What ADM-42 adds is the half §9.6 is actually
// about: **the article is fetched and displayed before anything is written**,
// and an article-scoped reference cannot be saved until somebody has read it.
//
// **Why the check comes before the save, when §9.5.7 describes it after.** The
// register grants no delete to anyone — a norm nothing depends on any more still
// carries the history of what documents once rested on it — so a mistyped
// article number saved first is a row watched forever that will never match
// anything. §9.6 asks for the rejection "at the cheapest possible moment", and
// the cheapest moment is before the row exists. The confirmation §9.5.7 asks for
// still happens after the save: the same text is read again against the saved
// norm, which is what records the first revision and what makes the norm
// `verified` rather than merely entered.
//
// `@legal-ai/law-refs` is imported directly by this component, which is not a
// breach of "components call api/, never data access" (DoD §2): it holds pure
// functions and no I/O. It is imported by the api layer too, and by the fetcher
// on the far side — one definition of what a link means, which is the whole
// reason it is a package.

import { useState } from "react";
import { normalizeArticle, normalizeLawLink } from "@legal-ai/law-refs";
import type { ProbeFailure } from "@legal-ai/law-refs";
import type { TranslationKey } from "@legal-ai/i18n";
import { useI18n } from "@legal-ai/i18n";
import { Button, FormField, Input, Textarea } from "@legal-ai/ui";
import type { NewLawReference } from "../api";
import type { AddOutcome, ArticleCheck } from "../hooks/useServiceLaw";

const LINK_REJECTION: Record<string, TranslationKey> = {
  not_a_url: "serviceLaw.link.not_a_url",
  unknown_source: "serviceLaw.link.unknown_source",
  not_an_act_url: "serviceLaw.link.not_an_act_url",
  unparsable_act_id: "serviceLaw.link.unparsable_act_id",
};

const ARTICLE_REJECTION: Record<string, TranslationKey> = {
  blank: "serviceLaw.article.blank",
  unrecognized: "serviceLaw.article.unrecognized",
};

/**
 * A sentence per refusal (§9.15's vocabulary, as copy).
 *
 * `Record<ProbeFailure, …>` rather than a lookup with a fallback, so a failure
 * added to the parser fails to compile here until somebody writes the sentence
 * for it. The set is closed for exactly this reason: a lawyer who mistyped an
 * article number and one whose source is down must not read the same words —
 * the first can fix it in five seconds and the second cannot fix it at all.
 */
const CHECK_FAILURE: Record<ProbeFailure, TranslationKey> = {
  transport: "serviceLaw.check.failure.transport",
  http_status: "serviceLaw.check.failure.http_status",
  act_identity_moved: "serviceLaw.check.failure.act_identity_moved",
  heading_missing: "serviceLaw.check.failure.heading_missing",
  heading_mismatch: "serviceLaw.check.failure.heading_mismatch",
  text_blank: "serviceLaw.check.failure.text_blank",
  text_implausibly_short: "serviceLaw.check.failure.text_implausibly_short",
  revision_date_unparsable: "serviceLaw.check.failure.revision_date_unparsable",
};

const OUTCOME: Record<AddOutcome, TranslationKey> = {
  confirmed: "serviceLaw.check.confirmed",
  moved: "serviceLaw.check.moved",
  unreachable: "serviceLaw.check.unreachable",
};

export function AddReferenceForm({
  serviceId,
  adding,
  errorKey,
  checking,
  check,
  checkErrorKey,
  addOutcome,
  onCheck,
  onAdd,
}: {
  serviceId: string;
  adding: boolean;
  errorKey: TranslationKey | null;
  checking: boolean;
  check: ArticleCheck | null;
  checkErrorKey: TranslationKey | null;
  addOutcome: AddOutcome | null;
  onCheck: (url: string, article: string) => Promise<void>;
  onAdd: (input: NewLawReference, confirmedFingerprint?: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [actTitle, setActTitle] = useState("");
  const [article, setArticle] = useState("");
  const [wholeAct, setWholeAct] = useState(false);
  const [actScopeReason, setActScopeReason] = useState("");
  const [reliedOn, setReliedOn] = useState("");

  /**
   * What the reading on screen is a reading *of*.
   *
   * Without it, a lawyer could check article 105, edit the number to 106, and
   * save against text they never saw — the confirmation would be attached to
   * the wrong article and would look exactly like a correct one.
   *
   * Editing a field deliberately does **not** clear the reading. A panel that
   * vanishes as somebody corrects a typo takes its own explanation with it; the
   * text stays, marked as being about what was checked before, and saving is
   * closed until it is checked again.
   */
  const [checkedFor, setCheckedFor] = useState<{ url: string; article: string } | null>(null);

  // Nothing typed yet is not a rejection. A form that turns red before the
  // reader has finished the first field is a form that gets ignored.
  const link = url.trim() === "" ? null : normalizeLawLink(url);
  const parsedArticle = wholeAct || article.trim() === "" ? null : normalizeArticle(article);

  const linkErrorKey = link !== null && !link.ok ? LINK_REJECTION[link.reason] : undefined;
  const articleErrorKey =
    parsedArticle !== null && !parsedArticle.ok
      ? ARTICLE_REJECTION[parsedArticle.reason]
      : undefined;

  const checkable = link !== null && link.ok && parsedArticle !== null && parsedArticle.ok;

  const stale =
    checkedFor !== null && (checkedFor.url !== url.trim() || checkedFor.article !== article.trim());

  const reading = check !== null && check.kind === "read" && !stale ? check.reading : null;

  const ready =
    link !== null &&
    link.ok &&
    actTitle.trim() !== "" &&
    reliedOn.trim() !== "" &&
    (wholeAct
      ? actScopeReason.trim() !== ""
      : // The gate this whole ticket is about: an article-scoped reference is
        // saved only after somebody has read the article it names.
        parsedArticle !== null && parsedArticle.ok && reading !== null);

  async function runCheck() {
    if (!checkable) return;
    setCheckedFor({ url: url.trim(), article: article.trim() });
    await onCheck(url.trim(), article.trim());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    const added = await onAdd(
      {
        serviceId,
        url: url.trim(),
        actTitle: actTitle.trim(),
        article: wholeAct ? null : article.trim(),
        actScopeReason: wholeAct ? actScopeReason.trim() : null,
        reliedOn: reliedOn.trim(),
      },
      reading?.fingerprint,
    );

    if (!added) return;

    setUrl("");
    setActTitle("");
    setArticle("");
    setWholeAct(false);
    setActScopeReason("");
    setReliedOn("");
    setCheckedFor(null);
  }

  return (
    <form className="space-y-4 rounded-card border border-line bg-paper p-4" onSubmit={submit}>
      <h2 className="text-lg font-semibold">{t("serviceLaw.add.title")}</h2>

      <FormField
        label={t("serviceLaw.add.url")}
        htmlFor="ref-url"
        hint={t("serviceLaw.add.urlHint")}
        error={linkErrorKey === undefined ? undefined : t(linkErrorKey)}
      >
        <Input id="ref-url" value={url} onChange={(event) => setUrl(event.target.value)} />
      </FormField>

      {link !== null && link.ok && (
        <div className="space-y-1 text-sm">
          {/* What will actually be watched, in the reader's words plus the
              identifier itself — so a lawyer who pasted the wrong act sees it
              here rather than in six months. */}
          <p className="text-inkSoft">{t("serviceLaw.add.resolved", { act: link.link.actId })}</p>
          {link.link.strippedRevision !== null && (
            // §9.5.1: the revision is resolved, not refused — and never
            // silently, because the reader asked for one thing and is getting
            // another.
            <p className="text-warn-ink">{t("serviceLaw.add.revisionStripped")}</p>
          )}
        </div>
      )}

      <FormField
        label={t("serviceLaw.add.actTitle")}
        htmlFor="ref-act-title"
        hint={t("serviceLaw.add.actTitleHint")}
      >
        <Input
          id="ref-act-title"
          value={actTitle}
          onChange={(event) => setActTitle(event.target.value)}
        />
      </FormField>

      {wholeAct ? (
        <FormField
          label={t("serviceLaw.add.wholeActReason")}
          htmlFor="ref-act-reason"
          hint={t("serviceLaw.add.wholeActHint")}
        >
          <Input
            id="ref-act-reason"
            value={actScopeReason}
            onChange={(event) => setActScopeReason(event.target.value)}
          />
        </FormField>
      ) : (
        <FormField
          label={t("serviceLaw.add.article")}
          htmlFor="ref-article"
          hint={t("serviceLaw.add.articleHint")}
          error={articleErrorKey === undefined ? undefined : t(articleErrorKey)}
        >
          <Input
            id="ref-article"
            value={article}
            onChange={(event) => setArticle(event.target.value)}
          />
        </FormField>
      )}

      {/* A native checkbox: `packages/ui` has Checkbox on the wave-1 list and
          not in the export yet, and a local one-off is what DoD §6 rules out.
          Semantic tokens only, so it inherits both themes. */}
      <label className="flex items-center gap-2 text-sm" htmlFor="ref-whole-act">
        <input
          id="ref-whole-act"
          type="checkbox"
          className="size-4 rounded border-line accent-brand"
          checked={wholeAct}
          onChange={(event) => setWholeAct(event.target.checked)}
        />
        {t("serviceLaw.add.wholeAct")}
      </label>

      {wholeAct ? (
        // §9.4: the act-level watch is the redaction date, and there is no one
        // article to read back. Said where the button would otherwise be, so
        // the difference is visible before saving rather than after.
        <p className="text-xs text-inkMute">{t("serviceLaw.add.actNotFetched")}</p>
      ) : (
        <div className="space-y-2">
          <Button
            variant="secondary"
            onClick={() => void runCheck()}
            disabled={!checkable || checking}
          >
            {t(checking ? "serviceLaw.check.checking" : "serviceLaw.check.button")}
          </Button>

          {stale && check !== null && (
            <p className="text-sm text-warn-ink">{t("serviceLaw.check.stale")}</p>
          )}

          {checkErrorKey !== null && <p className="text-sm text-danger-ink">{t(checkErrorKey)}</p>}

          {!stale && check !== null && check.kind === "refused" && (
            <p className="text-sm text-danger-ink">{t(CHECK_FAILURE[check.failure.reason])}</p>
          )}

          {reading !== null && (
            <div className="space-y-2 rounded-card border border-line bg-paperAlt p-3">
              <p className="text-sm font-medium">{t("serviceLaw.check.title")}</p>
              <p className="text-xs text-inkSoft">
                {reading.publishedRevisionDate === null
                  ? t("serviceLaw.check.noRedaction")
                  : t("serviceLaw.check.redaction", { date: reading.publishedRevisionDate })}
              </p>
              {/* The article itself: the publisher's words, scrollable, with the
                  line structure the normalization deliberately preserved (§9.7)
                  — this is what it was preserved for. */}
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm text-ink">
                {/* check-copy-ignore: the text of the law, as the source published it */}
                {reading.text}
              </pre>
              <p className="text-xs text-inkMute">{t("serviceLaw.check.instruction")}</p>
            </div>
          )}
        </div>
      )}

      <FormField
        label={t("serviceLaw.add.reliedOn")}
        htmlFor="ref-relied-on"
        hint={t("serviceLaw.add.reliedOnHint")}
      >
        <Textarea
          id="ref-relied-on"
          rows={2}
          value={reliedOn}
          onChange={(event) => setReliedOn(event.target.value)}
        />
      </FormField>

      {errorKey !== null && <p className="text-sm text-danger-ink">{t(errorKey)}</p>}

      {/* What happened to the norm after it was saved. `confirmed` is the
          ordinary path and still says so out loud: §9.10's whole point is that
          "checked and matching" is a claim somebody should be able to see. */}
      {addOutcome !== null && (
        <p
          className={addOutcome === "confirmed" ? "text-sm text-inkSoft" : "text-sm text-warn-ink"}
        >
          {t(OUTCOME[addOutcome])}
        </p>
      )}

      <Button type="submit" disabled={!ready || adding}>
        {t(adding ? "serviceLaw.add.submitting" : "serviceLaw.add.submit")}
      </Button>
    </form>
  );
}

// Entering a law reference (§9.5), minus the one step that needs a fetcher.
//
// The form normalizes as the lawyer types, and shows back what it resolved. That
// is the honest half of §9.6: the link is checked structurally, the article is
// checked for shape, and the pinned revision §9.2 warns about is resolved away
// with a sentence saying so. What is *not* here is the fetched text a lawyer
// confirms (§9.5.7) — that is ADM-42, and until it lands the screen says as much
// rather than implying the entry was verified.
//
// `@legal-ai/law-refs` is imported directly by this component, which is not a
// breach of "components call api/, never data access" (DoD §2): it holds pure
// functions and no I/O. It is imported by the api layer too, and by the fetcher
// when that arrives — one definition of what a link means, which is the whole
// reason it is a package.

import { useState } from "react";
import { normalizeArticle, normalizeLawLink } from "@legal-ai/law-refs";
import type { TranslationKey } from "@legal-ai/i18n";
import { useI18n } from "@legal-ai/i18n";
import { Button, FormField, Input, Textarea } from "@legal-ai/ui";
import type { NewLawReference } from "../api";

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

export function AddReferenceForm({
  serviceId,
  adding,
  errorKey,
  onAdd,
}: {
  serviceId: string;
  adding: boolean;
  errorKey: TranslationKey | null;
  onAdd: (input: NewLawReference) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [actTitle, setActTitle] = useState("");
  const [article, setArticle] = useState("");
  const [wholeAct, setWholeAct] = useState(false);
  const [actScopeReason, setActScopeReason] = useState("");
  const [reliedOn, setReliedOn] = useState("");

  // Nothing typed yet is not a rejection. A form that turns red before the
  // reader has finished the first field is a form that gets ignored.
  const link = url.trim() === "" ? null : normalizeLawLink(url);
  const parsedArticle = wholeAct || article.trim() === "" ? null : normalizeArticle(article);

  const linkErrorKey = link !== null && !link.ok ? LINK_REJECTION[link.reason] : undefined;
  const articleErrorKey =
    parsedArticle !== null && !parsedArticle.ok
      ? ARTICLE_REJECTION[parsedArticle.reason]
      : undefined;

  const ready =
    link !== null &&
    link.ok &&
    actTitle.trim() !== "" &&
    reliedOn.trim() !== "" &&
    (wholeAct ? actScopeReason.trim() !== "" : parsedArticle !== null && parsedArticle.ok);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    const added = await onAdd({
      serviceId,
      url: url.trim(),
      actTitle: actTitle.trim(),
      article: wholeAct ? null : article.trim(),
      actScopeReason: wholeAct ? actScopeReason.trim() : null,
      reliedOn: reliedOn.trim(),
    });

    if (!added) return;

    setUrl("");
    setActTitle("");
    setArticle("");
    setWholeAct(false);
    setActScopeReason("");
    setReliedOn("");
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

      {/* Said before the button, not after the write: the limitation is a
          property of the entry, not of whether it succeeded. */}
      <p className="text-xs text-inkMute">{t("serviceLaw.add.notFetched")}</p>

      {errorKey !== null && <p className="text-sm text-danger-ink">{t(errorKey)}</p>}

      <Button type="submit" disabled={!ready || adding}>
        {t(adding ? "serviceLaw.add.submitting" : "serviceLaw.add.submit")}
      </Button>
    </form>
  );
}

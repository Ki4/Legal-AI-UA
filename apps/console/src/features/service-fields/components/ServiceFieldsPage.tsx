// The questionnaire field dictionary of one service (§4.4).
//
// What §4.4 also describes and this screen does not build is the *map* — fields
// coloured by whether a template block uses them (used / extra / missing). That
// needs the block ↔ field links, which are ADM-20, and the spec says so
// plainly: without them the three colours would be guesses. A map that guesses
// is worse than no map, because `missing` is the one that is always a defect.

import { useState } from "react";
import { useI18n } from "@legal-ai/i18n";
import { Button, EmptyState, Spinner, useConfirm } from "@legal-ai/ui";
import { Link, useParams } from "react-router";
import { useServiceFields } from "../hooks/useServiceFields";
import { validateDraft, type FieldDraft, type QuestionnaireFieldItem } from "../api";
import { FieldEditor } from "./FieldEditor";
import { FieldsTable } from "./FieldsTable";

export function ServiceFieldsPage() {
  const { t, tCount } = useI18n();
  const { serviceId = "" } = useParams();
  const {
    page,
    loading,
    notFound,
    errorKey,
    saving,
    saveErrorKey,
    removeErrorKey,
    movingId,
    moveErrorKey,
    createField,
    updateField,
    removeField,
    moveField,
    reload,
  } = useServiceFields(serviceId);

  const { confirm, confirmation } = useConfirm();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionnaireFieldItem | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">{t("serviceFields.loading")}</span>
      </div>
    );
  }

  // Before the error branch: a mistyped id and a broken request are different
  // answers, and only one of them is worth a "try again" button (DoD §4).
  if (notFound) {
    return (
      <EmptyState
        title={t("serviceFields.notFound.title")}
        hint={t("serviceFields.notFound.hint")}
      />
    );
  }

  const fields = page?.fields ?? [];

  const submit = (draft: FieldDraft) => {
    const validation = validateDraft(draft, {
      checkKey: editing === null,
      takenKeys: fields.map((field) => field.key),
    });
    // The editor already refuses to submit an invalid draft; this is the second
    // reading, and it is what makes the narrow input types below true rather
    // than merely intended.
    if (!validation.ok) return;

    const shared = {
      label: draft.label.trim(),
      helpText: draft.helpText.trim() === "" ? null : draft.helpText.trim(),
      type: draft.type,
      required: draft.required,
      options: validation.options,
      personalData: validation.personalData,
    };

    const done =
      editing === null
        ? createField({ serviceId, key: draft.key, ...shared })
        : updateField({ id: editing.id, ...shared });

    void done.then((saved) => {
      if (saved) {
        setEditorOpen(false);
        setEditing(null);
      }
    });
  };

  const askToDelete = (field: QuestionnaireFieldItem) => {
    void confirm({
      title: t("serviceFields.delete.title", { label: field.label }),
      description: t("serviceFields.delete.description"),
      confirmLabel: t("serviceFields.delete.confirm"),
      cancelLabel: t("serviceFields.delete.cancel"),
      tone: "danger",
    }).then((confirmed) => {
      if (confirmed) void removeField(field.id);
    });
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("serviceFields.title")}</h1>
        <p className="mt-1 text-sm text-inkSoft">{t("serviceFields.subtitle")}</p>
        <Link
          to={`/services/${serviceId}`}
          className="mt-2 inline-block text-sm text-brand hover:underline"
        >
          {t("serviceFields.backToService")}
        </Link>
      </div>

      {errorKey !== null ? (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm text-danger-ink">{t(errorKey)}</p>
            <Button variant="secondary" onClick={reload}>
              {t("common.tryAgain")}
            </Button>
          </div>
          {/* An empty dictionary after a failed load is not an empty dictionary.
              Telling a lawyer the questionnaire asks nothing when the request
              simply broke is the mistake DoD §4 names as the most repeatable
              one here. */}
          <EmptyState
            title={t("serviceFields.failed.title")}
            hint={t("serviceFields.failed.hint")}
          />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              {t("serviceFields.add")}
            </Button>
            {fields.length > 0 && (
              <span className="text-sm text-inkMute">
                {tCount("serviceFields.count", fields.length)}
              </span>
            )}
          </div>

          {fields.length === 0 ? (
            <EmptyState
              title={t("serviceFields.empty.title")}
              hint={t("serviceFields.empty.hint")}
            />
          ) : (
            <FieldsTable
              fields={fields}
              movingId={movingId}
              busy={movingId !== null}
              onEdit={(field) => {
                setEditing(field);
                setEditorOpen(true);
              }}
              onDelete={askToDelete}
              onMove={(field, direction) => void moveField(field.id, direction)}
            />
          )}

          {/* Three writes, three sentences, kept apart. A reorder that failed
              must not tell the reader a field was not saved: they did not try to
              save a field (DoD §6). */}
          {moveErrorKey !== null && <p className="text-sm text-danger-ink">{t(moveErrorKey)}</p>}
          {removeErrorKey !== null && (
            <p className="text-sm text-danger-ink">{t(removeErrorKey)}</p>
          )}
        </>
      )}

      <FieldEditor
        open={editorOpen}
        field={editing}
        takenKeys={fields.map((field) => field.key)}
        saving={saving}
        saveErrorKey={saveErrorKey}
        onSubmit={submit}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />
      {confirmation}
    </section>
  );
}

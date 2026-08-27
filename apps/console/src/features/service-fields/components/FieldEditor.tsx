// One field, being added or edited — and with it ADM-19, the GDPR half.
//
// The shape of this form is dictated by three constraints in
// `20260811130000_questionnaire_fields.sql`, and it is worth being explicit that
// the form does not *enforce* them. Postgres does. What the form does is tell
// the reader which half is missing before the round trip, and refuse to send a
// row it already knows will be refused — the difference between "not saved:
// choose a legal basis" and a red box saying a constraint name.
//
// - the GDPR triad: personal data means a basis and a retention period, or all
//   three absent. Stated both ways, so unticking has to clear what was there.
// - special category is a *subset* of personal data, never an alternative. So
//   the Art. 9 controls live inside the Art. 6 block and disappear with it.
// - options exist for exactly the choice types, and never empty.
//
// The key is present when creating and read-only when editing, because the
// trigger refuses a rename and `FieldEdit` has no `key` to offer.

import { useEffect, useMemo, useState } from "react";
import { useI18n, type TranslationKey } from "@legal-ai/i18n";
import type { PersonalDataBasis, QuestionnaireFieldType, SpecialCategoryBasis } from "@legal-ai/db";
import {
  Button,
  Checkbox,
  Dialog,
  FormField,
  IconButton,
  Input,
  RadioGroup,
  Select,
} from "@legal-ai/ui";
import { Trash2 } from "lucide-react";
import {
  fieldTypeKey,
  personalDataBasisKey,
  specialCategoryBasisKey,
} from "../../../shared/vocabulary";
import {
  emptyDraft,
  draftOf,
  typeNeedsOptions,
  validateDraft,
  type FieldDraft,
  type FieldRejection,
  type QuestionnaireFieldItem,
} from "../api";

const FIELD_TYPES: readonly QuestionnaireFieldType[] = [
  "text",
  "long_text",
  "number",
  "date",
  "boolean",
  "select",
  "multi_select",
];

const BASES: readonly PersonalDataBasis[] = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "public_task",
  "legitimate_interests",
];

const SPECIAL_BASES: readonly SpecialCategoryBasis[] = [
  "explicit_consent",
  "employment_social_security",
  "vital_interests",
  "not_for_profit_body",
  "made_public_by_subject",
  "legal_claims",
  "substantial_public_interest",
  "health_care",
  "public_health",
  "archiving_research",
];

const REJECTION_KEY: Record<FieldRejection, TranslationKey> = {
  key_shape: "serviceFields.reject.key_shape",
  key_taken: "serviceFields.reject.key_taken",
  label_empty: "serviceFields.reject.label_empty",
  missing_basis: "serviceFields.reject.missing_basis",
  missing_retention: "serviceFields.reject.missing_retention",
  retention_not_positive: "serviceFields.reject.retention_not_positive",
  missing_special_basis: "serviceFields.reject.missing_special_basis",
  options_required: "serviceFields.reject.options_required",
  options_not_allowed: "serviceFields.reject.options_not_allowed",
};

export interface FieldEditorProps {
  open: boolean;
  /** Null when adding. Non-null makes the key read-only and prefills the rest. */
  field: QuestionnaireFieldItem | null;
  /** Keys already used by this service — what `key_taken` is checked against. */
  takenKeys: readonly string[];
  saving: boolean;
  /** The write's own failure, held as a key by the hook (DoD §6). */
  saveErrorKey: TranslationKey | null;
  onSubmit: (draft: FieldDraft) => void;
  onCancel: () => void;
}

export function FieldEditor({
  open,
  field,
  takenKeys,
  saving,
  saveErrorKey,
  onSubmit,
  onCancel,
}: FieldEditorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<FieldDraft>(emptyDraft);
  // Nothing is red before the first attempt. A form that objects to a blank key
  // the moment it opens is objecting to the reader not having typed yet.
  const [attempted, setAttempted] = useState(false);

  const editing = field !== null;

  useEffect(() => {
    if (!open) return;
    setDraft(field === null ? emptyDraft() : draftOf(field));
    setAttempted(false);
  }, [open, field]);

  const validation = useMemo(
    () =>
      validateDraft(draft, {
        // An existing field's key is not up for review: it cannot change, and
        // reporting it as taken would be reporting it against itself.
        checkKey: !editing,
        takenKeys,
      }),
    [draft, editing, takenKeys],
  );

  const rejections = validation.ok ? [] : validation.rejections;
  const shows = (rejection: FieldRejection) => attempted && rejections.includes(rejection);
  const errorFor = (rejection: FieldRejection) =>
    shows(rejection) ? t(REJECTION_KEY[rejection]) : undefined;

  const update = (patch: Partial<FieldDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const setType = (type: QuestionnaireFieldType) => {
    // Options are cleared when the type stops taking them, rather than kept in
    // case the reader changes their mind back. Kept, they are a row Postgres
    // refuses on save for a reason nothing on screen explains.
    update({ type, options: typeNeedsOptions(type) ? draft.options : [] });
  };

  const setPersonalData = (isPersonalData: boolean) => {
    // Unticking clears all five columns, because the constraint is stated both
    // ways: a basis left behind by a field that is no longer personal data is
    // refused just as firmly as a missing one.
    update(
      isPersonalData
        ? { isPersonalData }
        : {
            isPersonalData,
            basis: null,
            retentionDays: "",
            isSpecialCategory: false,
            specialBasis: null,
          },
    );
  };

  const submit = () => {
    setAttempted(true);
    if (validation.ok) onSubmit(draft);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={
        editing
          ? t("serviceFields.editor.editTitle", { label: field.label })
          : t("serviceFields.editor.createTitle")
      }
      closeLabel={t("serviceFields.editor.close")}
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            {t("serviceFields.editor.cancel")}
          </Button>
          <Button onClick={submit} loading={saving}>
            {t(saving ? "serviceFields.editor.saving" : "serviceFields.editor.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          htmlFor="field-key"
          label={t("serviceFields.editor.key")}
          hint={t(editing ? "serviceFields.editor.keyImmutable" : "serviceFields.editor.keyHint")}
          error={errorFor("key_shape") ?? errorFor("key_taken")}
        >
          <Input
            id="field-key"
            value={draft.key}
            readOnly={editing}
            disabled={editing}
            invalid={shows("key_shape") || shows("key_taken")}
            onChange={(event) => update({ key: event.target.value })}
          />
        </FormField>

        <FormField
          htmlFor="field-label"
          label={t("serviceFields.editor.label")}
          hint={t("serviceFields.editor.labelHint")}
          error={errorFor("label_empty")}
        >
          <Input
            id="field-label"
            value={draft.label}
            invalid={shows("label_empty")}
            onChange={(event) => update({ label: event.target.value })}
          />
        </FormField>

        <FormField
          htmlFor="field-help"
          label={t("serviceFields.editor.helpText")}
          hint={t("serviceFields.editor.helpTextHint")}
        >
          <Input
            id="field-help"
            value={draft.helpText}
            onChange={(event) => update({ helpText: event.target.value })}
          />
        </FormField>

        <FormField htmlFor="field-type" label={t("serviceFields.editor.type")}>
          <Select
            id="field-type"
            value={draft.type}
            options={FIELD_TYPES.map((type) => ({ value: type, label: t(fieldTypeKey[type]) }))}
            onChange={(event) => setType(event.target.value as QuestionnaireFieldType)}
          />
        </FormField>

        <Checkbox
          label={t("serviceFields.editor.required")}
          description={t("serviceFields.editor.requiredHint")}
          checked={draft.required}
          onChange={(event) => update({ required: event.target.checked })}
        />

        {typeNeedsOptions(draft.type) && (
          <OptionsEditor
            options={draft.options}
            error={errorFor("options_required")}
            onChange={(options) => update({ options })}
          />
        )}

        <div className="space-y-3 border-t border-line pt-4">
          <Checkbox
            label={t("serviceFields.editor.personalData")}
            description={t("serviceFields.editor.personalDataHint")}
            checked={draft.isPersonalData}
            invalid={shows("missing_basis") || shows("missing_retention")}
            onChange={(event) => setPersonalData(event.target.checked)}
          />

          {/* Inside the flag rather than beside it: there is no such thing as a
              basis for data that is not personal, and a control that can be
              filled in and then silently ignored is worse than one that is not
              there. */}
          {draft.isPersonalData && (
            <div className="space-y-4 border-l-2 border-line pl-4">
              <RadioGroup
                name="field-basis"
                legend={t("serviceFields.editor.basis")}
                options={BASES.map((basis) => ({
                  value: basis,
                  label: t(personalDataBasisKey[basis]),
                }))}
                value={draft.basis}
                onValueChange={(value) => update({ basis: value as PersonalDataBasis })}
                error={errorFor("missing_basis")}
              />

              <FormField
                htmlFor="field-retention"
                label={t("serviceFields.editor.retention")}
                hint={t("serviceFields.editor.retentionHint")}
                error={errorFor("missing_retention") ?? errorFor("retention_not_positive")}
              >
                <Input
                  id="field-retention"
                  type="number"
                  min={1}
                  step={1}
                  value={draft.retentionDays}
                  invalid={shows("missing_retention") || shows("retention_not_positive")}
                  onChange={(event) => update({ retentionDays: event.target.value })}
                />
              </FormField>

              <Checkbox
                label={t("serviceFields.editor.specialCategory")}
                description={t("serviceFields.editor.specialCategoryHint")}
                checked={draft.isSpecialCategory}
                onChange={(event) =>
                  update({
                    isSpecialCategory: event.target.checked,
                    specialBasis: event.target.checked ? draft.specialBasis : null,
                  })
                }
              />

              {draft.isSpecialCategory && (
                <FormField
                  htmlFor="field-special-basis"
                  label={t("serviceFields.editor.specialBasis")}
                  error={errorFor("missing_special_basis")}
                >
                  <Select
                    id="field-special-basis"
                    value={draft.specialBasis ?? ""}
                    placeholder={t("serviceFields.editor.specialBasis")}
                    options={SPECIAL_BASES.map((basis) => ({
                      value: basis,
                      label: t(specialCategoryBasisKey[basis]),
                    }))}
                    invalid={shows("missing_special_basis")}
                    onChange={(event) =>
                      update({ specialBasis: event.target.value as SpecialCategoryBasis })
                    }
                  />
                </FormField>
              )}
            </div>
          )}
        </div>

        {/* The write's own failure, kept apart from the field-level refusals
            above: one says the reader typed something wrong, the other says the
            request did not land. */}
        {saveErrorKey !== null && <p className="text-sm text-danger-ink">{t(saveErrorKey)}</p>}
      </div>
    </Dialog>
  );
}

function OptionsEditor({
  options,
  error,
  onChange,
}: {
  options: readonly string[];
  error?: string;
  onChange: (options: readonly string[]) => void;
}) {
  const { t } = useI18n();
  // Always one empty row to type into, so adding the first choice needs no
  // "add" click first — the empty ones are dropped by `validateDraft`.
  const rows = options.length === 0 ? [""] : options;

  return (
    <FormField
      htmlFor="field-option-0"
      label={t("serviceFields.editor.options")}
      hint={t("serviceFields.editor.optionsHint")}
      error={error}
    >
      <div className="space-y-2">
        {rows.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              id={`field-option-${index}`}
              value={option}
              placeholder={t("serviceFields.editor.optionPlaceholder")}
              onChange={(event) => {
                const next = [...rows];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <IconButton
              aria-label={t("serviceFields.editor.optionRemove")}
              icon={<Trash2 size={16} aria-hidden="true" />}
              disabled={rows.length === 1}
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
            />
          </div>
        ))}
        <Button variant="secondary" onClick={() => onChange([...rows, ""])}>
          {t("serviceFields.editor.optionAdd")}
        </Button>
      </div>
    </FormField>
  );
}

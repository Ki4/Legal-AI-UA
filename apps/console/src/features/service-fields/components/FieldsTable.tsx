// The dictionary as a list (§4.4). Editing lives in the dialog; this is the
// half a reader judges from.
//
// Reordering is two buttons rather than a drag. §4.4 says "drag to reorder" and
// this is a deliberate departure worth stating: the reader §12 describes is a
// non-technical lawyer who may be older and on a mouse, and a list that can only
// be reordered by dragging cannot be reordered by keyboard at all. Buttons are
// operable by everyone, need no new primitive, and a drag handle can be added
// over them later — the reverse is a rewrite.

import { useI18n } from "@legal-ai/i18n";
import { Badge, Button, IconButton, Table, TableCell, TableHead, TableRow } from "@legal-ai/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fieldTypeKey, personalDataBasisKey } from "../../../shared/vocabulary";
import type { QuestionnaireFieldItem } from "../api";

function PersonalData({ field }: { field: QuestionnaireFieldItem }) {
  const { t, tCount } = useI18n();
  const { personalData } = field;

  if (personalData.kind === "none") {
    return <span className="text-inkMute">{t("serviceFields.noPersonalData")}</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="warn">{t("serviceFields.personalData")}</Badge>
        {/* Art. 9 is a second statement on top of the first, so it renders as a
            second badge rather than as a different one. A lawyer scanning the
            column has to be able to see both at once. */}
        {personalData.kind === "special" && (
          <Badge tone="danger">{t("serviceFields.specialCategory")}</Badge>
        )}
      </div>
      <p className="text-xs text-inkSoft">{t(personalDataBasisKey[personalData.basis])}</p>
      <p className="text-xs text-inkMute">
        {tCount("serviceFields.retentionDays", personalData.retentionDays)}
      </p>
    </div>
  );
}

export function FieldsTable({
  fields,
  movingId,
  busy,
  onEdit,
  onDelete,
  onMove,
}: {
  fields: readonly QuestionnaireFieldItem[];
  movingId: string | null;
  busy: boolean;
  onEdit: (field: QuestionnaireFieldItem) => void;
  onDelete: (field: QuestionnaireFieldItem) => void;
  onMove: (field: QuestionnaireFieldItem, direction: "up" | "down") => void;
}) {
  const { t, tCount } = useI18n();

  return (
    <Table>
      <TableHead>
        <tr>
          <th>{t("serviceFields.column.field")}</th>
          <th>{t("serviceFields.column.type")}</th>
          <th>{t("serviceFields.column.gdpr")}</th>
          <th>{t("serviceFields.column.order")}</th>
          <th>{t("serviceFields.column.actions")}</th>
        </tr>
      </TableHead>
      <tbody>
        {fields.map((field, index) => (
          <TableRow key={field.id}>
            <TableCell>
              <div className="space-y-1">
                {/* check-copy-ignore: a field label is data a lawyer typed */}
                <p className="font-medium">{field.label}</p>
                {/* The key is what blocks reference, and it is set in stone once
                    saved — so it is on the row rather than behind the editor. */}
                {/* check-copy-ignore: a field key is data */}
                <p className="font-mono text-xs text-brand">{field.key}</p>
                {field.helpText !== null && (
                  // check-copy-ignore: help text is a lawyer's own sentence
                  <p className="text-xs text-inkMute">{field.helpText}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <p>{t(fieldTypeKey[field.type])}</p>
                {field.options !== null && (
                  <p className="text-xs text-inkMute">
                    {tCount("serviceFields.optionsCount", field.options.length)}
                  </p>
                )}
                <Badge tone={field.required ? "brand" : "neutral"}>
                  {t(field.required ? "serviceFields.required" : "serviceFields.optional")}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <PersonalData field={field} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                {/* Disabled at the ends rather than hidden: a control that
                    appears and disappears as rows move is harder to aim at than
                    one that is simply unavailable. */}
                <IconButton
                  aria-label={t("serviceFields.moveUp")}
                  icon={<ChevronUp size={16} aria-hidden="true" />}
                  disabled={busy || index === 0}
                  onClick={() => onMove(field, "up")}
                />
                <IconButton
                  aria-label={t("serviceFields.moveDown")}
                  icon={<ChevronDown size={16} aria-hidden="true" />}
                  disabled={busy || index === fields.length - 1}
                  onClick={() => onMove(field, "down")}
                />
                {movingId === field.id && (
                  <span className="sr-only">{t("serviceFields.moving")}</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => onEdit(field)} disabled={busy}>
                  {t("serviceFields.edit")}
                </Button>
                <Button variant="danger" onClick={() => onDelete(field)} disabled={busy}>
                  {t("serviceFields.delete")}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}

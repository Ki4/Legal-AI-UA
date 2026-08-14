// The rows and nothing else. Loading, the emptinesses and the errors belong to
// the page, exactly as they do in the catalogue: they are the same regardless
// of what the table would have rendered.

import { useI18n } from "@legal-ai/i18n";
import { Table, TableCell, TableHead, TableRow } from "@legal-ai/ui";
import { formatDateTime } from "../../../shared/format";
import { auditActionKey, auditedTableKey } from "../../../shared/vocabulary";
import type { HistoryActor, ServiceHistoryEvent } from "../api";

function Actor({ actor }: { actor: HistoryActor }) {
  const { t } = useI18n();

  return (
    <>
      {actor.kind === "person" ? (
        actor.fullName
      ) : actor.kind === "unnamed" ? (
        // Not a dash and not "system". Somebody did this; their profile is not
        // one this reader can see — a deactivated account, or a colleague RLS
        // hides — and saying so is the difference between an incomplete record
        // and a wrong one.
        <span className="text-inkMute">{t("history.actor.unnamed")}</span>
      ) : (
        <span className="text-inkMute">{t("history.actor.system")}</span>
      )}

      {/* The role held at the time, not the role held now (§6.2), and rendered
          raw: `admin` and `lawyer` are the words the RLS policies and the JWT
          are written in, and a reader comparing this screen against a policy
          needs the same word in both. Only its absence is our sentence. */}
      {actor.roleAtTheTime !== null && (
        <span className="ml-1 text-xs text-inkMute">
          {/* check-copy-ignore: a role name is a policy word, never translated — DoD §6 */}
          {actor.roleAtTheTime}
        </span>
      )}
    </>
  );
}

export function HistoryTable({ events }: { events: ServiceHistoryEvent[] }) {
  const { t, intlLocale } = useI18n();

  return (
    <Table>
      <TableHead>
        <tr>
          <th>{t("history.field.when")}</th>
          <th>{t("history.field.who")}</th>
          <th>{t("history.field.what")}</th>
          <th>{t("history.field.action")}</th>
          <th>{t("history.field.changed")}</th>
        </tr>
      </TableHead>
      <tbody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell>{formatDateTime(event.occurredAt, intlLocale)}</TableCell>
            <TableCell>
              <Actor actor={event.actor} />
            </TableCell>
            <TableCell>
              {event.entity === null ? (
                // A table this console has no word for yet. Its own name is
                // visibly odd, which is the point: an empty cell would hide
                // that the log knows something the screen does not.
                <span className="text-inkMute">{event.entityTable}</span>
              ) : (
                t(auditedTableKey[event.entity])
              )}
            </TableCell>
            <TableCell>{t(auditActionKey[event.action])}</TableCell>
            <TableCell>
              {event.changedColumns.length === 0 ? (
                // An insert and a delete change the whole row, so naming its
                // columns would say nothing. A dash says that better than a
                // list of every column the table has.
                <span className="text-inkMute">—</span>
              ) : (
                // Column names, raw and in the schema's own words. A dictionary
                // would have to be extended by every migration that adds a
                // column and would silently fall back to nothing in between;
                // the reader of an audit log is someone who can be trusted with
                // `published_at`, and it is the word they will find in the
                // database if they go looking.
                <span className="text-xs text-inkSoft">
                  {/* check-copy-ignore: column names are schema words, shown as the log recorded them */}
                  {event.changedColumns.join(", ")}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}

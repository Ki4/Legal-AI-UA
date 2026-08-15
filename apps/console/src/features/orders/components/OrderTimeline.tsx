// The timeline, which is a read of `audit_events` and not a second history
// (ADR-0010). §6.1 says current status is a projection of that log, and this is
// the projection: an event that moved the order names the state it moved it to,
// and one that did not names the columns it touched.

import { useI18n } from "@legal-ai/i18n";
import { Badge, Table, TableCell, TableHead, TableRow } from "@legal-ai/ui";
import type { AuditActor } from "../../../shared/audit";
import { formatDateTime } from "../../../shared/format";
import { auditActionKey, orderStatusKey } from "../../../shared/vocabulary";
import type { OrderEvent } from "../api";
import { statusTone } from "./statusTone";

function Actor({ actor }: { actor: AuditActor }) {
  const { t } = useI18n();

  return (
    <>
      {actor.kind === "person" ? (
        actor.fullName
      ) : actor.kind === "unnamed" ? (
        // Somebody did this and their profile is not one this reader can see.
        // Saying so is the difference between an incomplete record and a wrong
        // one (DoD §5).
        <span className="text-inkMute">{t("history.actor.unnamed")}</span>
      ) : (
        // No actor at all: `auth.uid()` is null outside a request, so a seed, a
        // migration or the retention job lands here rather than being blamed on
        // whoever deployed last.
        <span className="text-inkMute">{t("history.actor.system")}</span>
      )}

      {actor.roleAtTheTime !== null && (
        <span className="ml-1 text-xs text-inkMute">
          {/* check-copy-ignore: a role name is a policy word, never translated — DoD §6 */}
          {actor.roleAtTheTime}
        </span>
      )}
    </>
  );
}

export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const { t, intlLocale } = useI18n();

  return (
    <Table>
      <TableHead>
        <tr>
          <th>{t("history.field.when")}</th>
          <th>{t("history.field.who")}</th>
          <th>{t("order.timeline.what")}</th>
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
              {event.statusAfter !== null ? (
                // The state this event left the order in. What §6.1 means by a
                // projection: the column on the card and this badge are the
                // same fact, arrived at from opposite ends.
                <Badge tone={statusTone(event.statusAfter)}>
                  {t(orderStatusKey[event.statusAfter])}
                </Badge>
              ) : event.changedColumns.length > 0 ? (
                // Column names, raw and in the schema's own words — the same
                // decision the history screen made, for the same reason: a
                // dictionary would need extending by every migration and would
                // fall back to nothing in between.
                <span className="text-xs text-inkSoft">
                  {/* check-copy-ignore: column names are schema words, shown as the log recorded them */}
                  {event.changedColumns.join(", ")}
                </span>
              ) : (
                // An insert, where the whole row is the change and naming its
                // columns would say nothing.
                <span className="text-inkSoft">{t(auditActionKey[event.action])}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}

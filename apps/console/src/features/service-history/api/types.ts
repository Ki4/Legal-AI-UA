// View models for the per-service history (spec §4.8). What the screen renders,
// not what `audit_events` holds (ADR-0012, convention 1).
//
// Two things the table carries are deliberately absent here.
//
//   `before` and `after`. The log records whole rows; a screen that renders
//   them is a diff view, which is a larger screen than this one and needs its
//   own decisions about which values a reader may see. `changedColumns` answers
//   §4.8's question — who changed what and when — without any of that, and it
//   is the field ADR-0010 designed for exactly this: the name survives
//   redaction, the value does not.
//
//   `serviceId` on the event. Every row on this screen belongs to the service
//   in the URL; repeating it per row would invite a component to filter, which
//   is the database's job and is already done.

import type { AuditAction, AuditedTable } from "@legal-ai/db";

/**
 * Who acted, in the three states the log can actually produce. They are one
 * field rather than a nullable name because collapsing them says something
 * false: "system" against a change a person made, or a blank where a colleague
 * this reader may not see stands (DoD §5).
 *
 * - `person` — the actor's profile was readable, so there is a name.
 * - `unnamed` — somebody acted, and their profile is not readable: a
 *   deactivated account, or a row RLS hides from this reader.
 * - `system` — no actor at all. `auth.uid()` is null outside a request, so a
 *   migration, a seed or a scheduled job lands here rather than being
 *   attributed to whoever happened to deploy.
 */
export type HistoryActor =
  | { kind: "person"; id: string; fullName: string; roleAtTheTime: string | null }
  | { kind: "unnamed"; id: string; roleAtTheTime: string | null }
  | { kind: "system"; roleAtTheTime: string | null };

export interface ServiceHistoryEvent {
  /**
   * `audit_events.id`, a bigint. It arrives as a JSON number and is kept as
   * one: converting it to a string here would look like precision was being
   * protected while the loss, if it ever happened, already happened in the
   * transport. A log would need 2^53 rows to reach that.
   */
  id: number;

  /** ISO 8601 (ADR-0012, convention 2). */
  occurredAt: string;

  action: AuditAction;

  /**
   * The table the change happened on, when it is one this console has a word
   * for, and null when it is not. Null is not an error state: a migration that
   * adds an audit trigger to a new table produces events before anybody adds it
   * to `AUDITED_TABLES`, and the screen shows `entityTable` raw in the meantime
   * rather than an empty cell.
   */
  entity: AuditedTable | null;

  /** Always kept, so nothing is lost when `entity` is null. */
  entityTable: string;

  entityId: string;

  /**
   * Which columns an update touched, never their values. Empty for an insert or
   * a delete, where the whole row is the change and naming its columns would
   * say nothing.
   */
  changedColumns: string[];

  actor: HistoryActor;
}

export interface ServiceHistoryPage {
  serviceId: string;
  serviceTitle: string;

  /** Newest first. */
  events: ServiceHistoryEvent[];

  /**
   * Whether the log holds more events for this service than were asked for.
   * Answered by fetching one row past the limit and dropping it, so it is a
   * fact about the data rather than a guess from a full page.
   */
  hasMore: boolean;
}

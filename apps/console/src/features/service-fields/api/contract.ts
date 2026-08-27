// The contract (ADR-0012). Every implementation is typed as `ServiceFieldsApi`,
// so a drifting one fails to compile rather than failing in a browser.

import type {
  FieldEdit,
  NewQuestionnaireField,
  QuestionnaireFieldItem,
  ServiceFieldsPage,
} from "./types";

export interface ServiceFieldsApi {
  /**
   * The service and its dictionary, in `position` order.
   *
   * Throws `AppError("not_found")` when there is no such service. A service
   * with no fields is not an error and not "not found" — it is the empty state,
   * and it is what every service looks like today.
   */
  listForService(serviceId: string): Promise<ServiceFieldsPage>;

  /** Throws `AppError("validation")` for anything in `FieldRejection`. */
  create(input: NewQuestionnaireField): Promise<QuestionnaireFieldItem>;

  /**
   * `key` is deliberately not in `FieldEdit`. The trigger refuses to change it
   * and this signature refuses to offer it, so the screen never asks a question
   * whose only answer is an exception.
   */
  update(input: FieldEdit): Promise<QuestionnaireFieldItem>;

  /** Returns the id it removed, so the caller drops the row it knows is gone. */
  remove(fieldId: string): Promise<string>;

  /**
   * Swap one field with its neighbour in `position` order.
   *
   * Named for the intent rather than for the write, because the write is two
   * rows and the intent is one gesture: a caller handed "set this to 3" would
   * have to know what else is at 3. Returns the whole list — the two rows that
   * moved are not the whole answer once positions are re-derived.
   */
  move(fieldId: string, direction: "up" | "down"): Promise<readonly QuestionnaireFieldItem[]>;
}

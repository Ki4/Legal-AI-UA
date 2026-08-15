// The swap point. One line picks the implementation (ADR-0012).
//
// Live from the first commit, like the orders screens and for the same reason
// turned the other way round. `orders` has no writer, so fixtures would have
// invented four orders that do not exist; `law_norms` has a writer — the lawyer
// reading this screen — so fixtures would show four norms the register does not
// hold and then accept an entry that goes nowhere. Either way the fixture is the
// version nobody can tell from a working one.
//
// `law.mock.ts` stays. It is what the contract tests run against: the
// normalization, the find-before-create that makes §9.3 true in practice, the
// derived freshness and every refusal are assertable without a database.

import type { LawApi } from "./contract";
import { supabaseLawApi } from "./law.supabase";

export const lawApi: LawApi = supabaseLawApi;

export type { LawApi } from "./contract";
export { freshnessOf, STALE_AFTER_INTERVALS } from "./freshness";
export type {
  CadenceChange,
  LawNormListItem,
  NewLawReference,
  NormDependent,
  NormFreshness,
  ServiceLawPage,
  ServiceLawRef,
} from "./types";

import type { Database } from "@legal-ai/db";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy apps/console/.env.example to apps/console/.env and fill in the values.",
  );
}

// Typed with the generated schema — but that only checks a query naming a
// column that no longer exists when the caller lets TypeScript infer the
// result from the query itself (`QueryData<typeof query>` from
// `@supabase/supabase-js`, applied to a `select()` string that is a literal
// known at compile time). `.returns<T>()` is not that: it is an assertion
// that discards what this client inferred and substitutes whatever type you
// hand it, so a query naming a column that no longer exists still returns
// undefined at runtime and compiles anyway. Every `api/*.supabase.ts` file is
// responsible for deriving its row type from its query, not asserting one
// over it — see `apps/console/src/features/services/api/services.supabase.ts`
// for the pattern.
export const supabase = createClient<Database>(url, anonKey);

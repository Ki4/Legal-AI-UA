import type { Database } from "@legal-ai/db";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy apps/console/.env.example to apps/console/.env and fill in the values.",
  );
}

// Typed with the generated schema, so a query naming a column that no longer
// exists fails to compile instead of returning undefined at runtime.
export const supabase = createClient<Database>(url, anonKey);

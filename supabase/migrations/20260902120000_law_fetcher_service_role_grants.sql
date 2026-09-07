-- The fetcher gets the privileges its design already assumed it had.
--
-- **Found by running it.** `law-article` had never executed outside a compiler:
-- Docker was down when it landed, so `supabase functions serve` had never run
-- and the debt was recorded rather than paid. The first real request answered
-- `permission denied for table law_norms`, from the client holding the
-- service-role key — the one identity the whole function is built around.
--
-- **Why the hole was invisible.** `service_role` bypasses RLS (ADR-0019), and
-- every discussion of this table's access is about RLS, so "the fetcher writes
-- as service_role" read as "the fetcher can write". Privileges are the other
-- axis and RLS does not touch them. `20260813120000` had already stated the
-- fact in its own comment — "`service_role` already holds no DML on public
-- tables ... so the gateway will have to be granted what it needs explicitly
-- when it lands" — and this function is the first such backend to land. The
-- sentence was correct and nothing was watching for the day it came due.
--
-- The tables this repository creates are owned by `postgres`, and the platform's
-- default privileges that hand `service_role` its DML are attached to
-- `supabase_admin`. So every domain table here reaches `service_role` as
-- `Dxtm` — truncate, references, trigger, maintain — and none of the four verbs
-- anybody wanted. Not a revocation: a grant that was never inherited.
--
-- **Named columns, not `grant update`.** `index.ts` says fingerprint and
-- normalizer_version are the trigger's to write, so that the register and the
-- revision log cannot state two different things. That was a comment; here it
-- becomes a privilege, and `law_norms_adopt_revision` is `security definer`, so
-- the trigger keeps writing them under its owner's rights while the fetcher
-- cannot. The same pattern, and the same cost, as the grant to `authenticated`
-- in `20260830120000`: a new machine-written column is not granted by default,
-- and a fetcher that cannot write one fails loudly on its first attempt.

-- Read the register ------------------------------------------------------------
--
-- Table-level, deliberately. The fetcher reads six columns today; ADM-44's
-- scheduler reads the cadence and the timestamps to decide what is due, and a
-- column list that has to grow every time a probe asks a new question is a list
-- that will be widened in a hurry by whoever is blocked by it. Reading the
-- register is not the privilege worth being precise about — writing it is.
grant select on table public.law_norms to service_role;

-- Say what a check found ---------------------------------------------------------
--
-- Exactly §9.7's three columns, and exactly the three the adopt-revision trigger
-- deliberately leaves alone, because two of them are judgements: whether a check
-- happened, and whether what it found matches what a person confirmed.
grant update (
  state,
  last_checked_at,
  last_verified_at
) on table public.law_norms to service_role;

-- Write the log ------------------------------------------------------------------
--
-- `origin` is absent on purpose and it is the sharpest line here. Its default is
-- `observed`, which is the only value an observation is entitled to assert;
-- `renormalized` is a claim about our own rules having changed, which a probe
-- cannot make and which `handler.ts` refuses to reach. Withholding the column
-- means a future recomputation pass has to be granted it by name — a migration
-- somebody writes on purpose, rather than a default that was always open.
grant insert (
  norm_id,
  fingerprint,
  normalizer_version,
  content,
  published_revision_date
) on table public.law_norm_revisions to service_role;

-- What the scheduler asks for: the norms whose next check is owed (§9.8, ADM-44).
--
-- `20260815140000` built the cadence and named this reader in three of its own
-- comments — "the scheduler (ADM-44) reads this one" — without building it. This
-- is that reader, and writing it settled three questions the earlier file had
-- left to whoever came next.
--
-- **1. Due-ness is `last_checked_at`, not `last_verified_at`.** The index in
-- `20260815140000` sorts on `last_verified_at asc nulls first` and its comment
-- says the scheduler reads it. That index is right about *staleness* — §9.10's
-- alarm, and what ADM-49's health screen will order by — and wrong about *due-
-- ness*, which is a different question with a different answer. A norm whose
-- source is down never gets a `last_verified_at`, so a schedule driven by that
-- column would re-probe it on every single sweep, forever, hammering a
-- publisher that is already having a bad day and starving every other norm out
-- of the batch. A check that failed is still a check: it cost a request and it
-- happened at a time. So the cadence counts attempts, the alarm counts
-- successes, and both columns exist precisely because those are two facts.
--
-- **2. The interval is the derived one.** `effective_probe_interval` rather than
-- the stored `probe_interval`, for the reason that function was written: three
-- orderings of writes slip past the guard, and the last of them — a service
-- being *published* after the dependency exists — touches neither table and so
-- can never be caught by a trigger. Reading the raw column here would be the
-- one place the cap is outrun, in the one component whose whole job is to
-- honour it.
--
-- **3. Act-scoped norms are excluded, and the exclusion is load-bearing.**
-- `handler.ts` answers `act_scope_unsupported` for a norm with no article and —
-- correctly — writes nothing, because there is nothing it could honestly record.
-- Handing those rows to a sweeper therefore does not merely waste a call: the
-- row's `last_checked_at` stays null, null sorts first, and it is back at the
-- head of the very next batch. A handful of act-scoped norms would occupy the
-- front of every sweep permanently and the article-scoped ones behind them
-- would never be reached. The act-level watch is the redaction date on the act's
-- shell page (§9.5, §9.7) and it is a different probe against a different unit,
-- which nothing stores yet. Until it exists, this function says so by omission
-- and this comment says so out loud.

-- Ordering, and why a second index -----------------------------------------------
--
-- Oldest attempt first, nulls first: a norm never checked is the most overdue
-- row in the table, not the least. Same reasoning as `law_norms_by_verification`
-- and a different column, for the reason above — they are not redundant, they
-- answer the two questions §9.10 refuses to render alike.
create index law_norms_by_check on public.law_norms (last_checked_at asc nulls first);

create or replace function public.law_norms_due_for_probe (batch_limit integer default 50)
returns table (
  id uuid,
  canonical_url text,
  article text,
  state public.law_norm_state,
  fingerprint text,
  normalizer_version integer,
  last_checked_at timestamptz,
  probe_interval interval
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id,
    n.canonical_url,
    n.article,
    n.state,
    n.fingerprint,
    n.normalizer_version,
    n.last_checked_at,
    public.effective_probe_interval (n.id)
  from public.law_norms n
  where n.article is not null
    and (
      n.last_checked_at is null
      or n.last_checked_at + public.effective_probe_interval (n.id) <= now()
    )
  order by n.last_checked_at asc nulls first, n.id
  limit greatest(coalesce(batch_limit, 0), 0);
$$;

comment on function public.law_norms_due_for_probe (integer) is
  'The batch ADM-44 sweeps: article-scoped norms whose last attempt is older than the cadence the platform honours, most overdue first. Due-ness counts attempts (last_checked_at); §9.10''s alarm counts successes (last_verified_at).';

-- Who may ask ---------------------------------------------------------------------
--
-- The sweeper, and nobody else. A lawyer has no use for "what is due next" — the
-- question a person asks is "what is stale", which is ADM-49's health screen over
-- `last_verified_at` and is not this. Granting it to `authenticated` because it
-- looks harmless would make a batch cursor part of the console's surface, and the
-- next person to widen this function would widen it for two callers instead of
-- one. `effective_probe_interval` stays granted to `authenticated`: a screen
-- showing a lawyer the cadence their override actually produced is a real need,
-- and one row is not a queue.
revoke all on function public.law_norms_due_for_probe (integer) from public, anon, authenticated;
grant execute on function public.law_norms_due_for_probe (integer) to service_role;

-- `security definer` and the register ---------------------------------------------
--
-- Definer rather than invoker, and it is worth being explicit about what that
-- does and does not hand out. `service_role` already bypasses RLS (ADR-0019) and
-- `20260902120000` granted it `select` on `law_norms`, so this function gives its
-- one caller nothing it could not select for itself; what definer buys is
-- `effective_probe_interval`, which is itself definer and which no future,
-- narrower caller would be able to execute. The function is `stable`, takes no
-- text, and interpolates nothing, so the usual definer hazard has no surface here.

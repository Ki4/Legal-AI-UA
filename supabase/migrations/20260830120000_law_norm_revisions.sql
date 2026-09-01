-- What an article said, kept at every fingerprint change (spec §9.7, ADM-43).
--
-- `20260815140000_law_norm_register.sql` shipped the register with a
-- `fingerprint` column and nothing behind it, and said the fetcher was the next
-- pass. This is the half of that pass the schema was missing, and it is missing
-- in a way worth stating plainly: **§9.7 requires the normalized text itself to
-- be kept, and the register kept only its hash.**
--
-- A hash detects; it does not reconstruct, and it cannot be run backwards. With
-- only a fingerprint the platform can say that the article under an issued
-- document moved, and never what it used to say — so the diff would exist for
-- the one second it is produced, and the lawyer triaging that signal six months
-- later would have the `relied_on` sentence and nothing else. §9.16 gives them
-- one business day to decide whether a change matters. They cannot decide it
-- against a hash.
--
-- Three further things follow from keeping the text, and each is why this table
-- is worth its rows rather than a nicety:
--
--   1. **Our own normalization becomes safe to revise.** A stored text plus its
--      `normalizer_version` is something to recompute from. Without it, the
--      morning we change a whitespace rule is the morning two hundred norms go
--      `drifted` at once with no way to tell our edit from the legislature's —
--      the silent-failure shape §9.15 is written against, arriving from inside.
--   2. **ADM-24's impact index has something to show.** "Which issued documents
--      rested on this, and on what wording" is not answerable from a hash.
--   3. **§9.12's diff classification has an input.** When the core is asked
--      whether a change is editorial or substantive, this is what it reads.
--
-- Law is public, so nothing here touches §7.2 or GDPR, and a few hundred
-- articles cost nothing to store — §9.7 makes both points explicitly.
--
-- **Still nothing fetches.** The fetcher is the edge function of ADR-0020 and is
-- the next pass again; this is the table it writes into, plus the invariants
-- that hold whatever writes it. `packages/law-refs/src/text.ts` is the other
-- half that landed with this migration: one normalization, one fingerprint
-- format, imported by the console and by Deno alike.

-- Why a revision exists ---------------------------------------------------------
--
-- **The column that stops us alarming ourselves.** The header above claims that
-- keeping the text makes our own normalization safe to revise. Keeping the text
-- is necessary for that and it is not sufficient, and the gap is worth naming
-- because it is invisible until the morning it costs a day:
--
-- Bump `NORMALIZER_VERSION`, and the next probe of an *unchanged* article
-- reduces it under new rules and hashes to a new fingerprint. Nothing in the
-- text moved. Nothing in the law moved. But a fingerprint that differs from the
-- stored one is, to every reader downstream, the definition of a drift — so two
-- hundred norms go `drifted` on one morning and two hundred signals land in a
-- triage queue with a one-business-day clock on each (§9.16). That is precisely
-- the "no way to tell our edit from the legislature's" failure, arriving
-- *after* the text was dutifully kept.
--
-- So a revision says which of the two it is. `observed` is the publisher's
-- doing; `renormalized` is ours, and ADM-45 creates no signal for it.
--
-- **What this deliberately does not do is infer the label.** The tempting rule
-- — "a row whose normalizer_version differs from the previous one must be
-- `renormalized`" — is wrong in the one case that matters most: the article
-- changed *and* we bumped the normalizer between two probes. Both happened, the
-- legislative half is the half a lawyer must see, and a rule inferring the
-- label would hide it. The fetcher knows which it did, because it can reduce the
-- newly fetched text under the *old* normalizer and compare. So the label is
-- asserted by the one component that can know it, and the guard below only
-- refuses the claim that is incoherent on its face.
create type public.law_revision_origin as enum (
  -- The publisher's text moved.
  'observed',
  -- Our reduction of the publisher's text moved. Not a legislative event.
  'renormalized'
);

-- The revisions ---------------------------------------------------------------

create table public.law_norm_revisions (
  id uuid primary key default gen_random_uuid (),

  -- `restrict`, matching `service_law_refs.norm_id` and for a related reason.
  -- The register has no delete policy and no delete grant at all, because a norm
  -- nothing depends on any more still carries the history of what it was. This
  -- is that history, so it is also what makes the refusal mean something.
  norm_id uuid not null references public.law_norms (id) on delete restrict,

  -- `sha256:` and lowercase hex, produced by `fingerprintArticleText`. The
  -- prefix is not decoration: it says which algorithm produced the value, so
  -- that changing the algorithm is a readable event rather than a table of
  -- hashes that quietly stop comparing. `seed.sql` already wrote this shape.
  fingerprint text not null check (fingerprint ~ '^sha256:[0-9a-f]{64}$'),

  -- Which text reduction was hashed — `NORMALIZER_VERSION` in
  -- `packages/law-refs`. A separate axis from the algorithm above: either can
  -- move without the other, and a row carrying only one of them is ambiguous.
  normalizer_version integer not null check (normalizer_version >= 1),

  -- Whose doing this revision is. See the note above the enum; the short form is
  -- that without it a normalizer bump is indistinguishable from an amendment,
  -- and the indistinguishable version is the one that pages a lawyer.
  origin public.law_revision_origin not null default 'observed',

  -- The normalized article text. The point of the whole table.
  --
  -- **`> 0` and not the plausibility floor.** §9.15's "an implausibly short
  -- extraction is a failure" is a real rule and it is deliberately not restated
  -- here, because it is a number and a number written twice is two numbers. It
  -- lives in `MIN_PLAUSIBLE_ARTICLE_LENGTH`, where the fetcher and its fixtures
  -- share it; what the database asserts is only the part that can never be
  -- revised — that a revision with no text is not a revision.
  content text not null check (length(btrim(content)) > 0),

  -- The redaction date the publisher states, when the parser read one. Nullable
  -- because a column cannot tell "the page did not say" from "the parser cannot
  -- yet look", and §9.15 condition 1 is where an unparseable date is turned into
  -- `unreachable`. An assertion belongs in the thing that asserts.
  --
  -- **And no lower bound, which was nearly added.** A floor at independence would
  -- catch the obvious parser failure — a mangled year arriving as a plausible
  -- date — and it would also refuse the truth. Acts of the Ukrainian SSR are
  -- still in force and still cited: `322-08`, the labour code, is from 1971, and
  -- a redaction date genuinely predates 1991 for anything not amended since. A
  -- constraint that rejects a real value to catch a hypothetical one is a
  -- migration that fails on the first honest row.
  published_revision_date date,

  -- When we saw it. Distinct from `created_at` in intent even where they agree:
  -- a backfill from stored fixtures would set the first and not the second.
  --
  -- **`clock_timestamp()` and not `now()`**, which is the one place in this
  -- schema where the difference bites. `now()` is the *transaction* timestamp, so
  -- every row written in one transaction shares it to the microsecond — and this
  -- column is what `observed_at desc` orders by, in the guard and in the adopt
  -- trigger and in whatever screen shows a history. Two rows for one norm in one
  -- transaction would be ordered arbitrarily, and "which of these is the current
  -- text" would have no answer. A wall-clock reading is also simply the truer
  -- statement: this records a moment of observation, not a unit of work.
  observed_at timestamptz not null default clock_timestamp(),

  created_at timestamptz not null default now()
);

comment on table public.law_norm_revisions is
  'What a watched article said, kept at every fingerprint change (§9.7). A hash detects a change; only this reconstructs one.';

comment on column public.law_norm_revisions.content is
  'Normalized article text, reduced by normalizeArticleText in packages/law-refs. Kept so our own normalization stays revisable and so a diff outlives the second it was produced in.';

comment on column public.law_norm_revisions.normalizer_version is
  'Which reduction produced the fingerprint. Separate from the sha256: prefix, which says which digest did.';

-- The register's own read, and the one the fetcher makes on every probe that
-- moved: the newest revision of this norm.
create index law_norm_revisions_by_norm on public.law_norm_revisions (norm_id, observed_at desc);

-- No `unique (norm_id, fingerprint)`, and the omission is deliberate ------------
--
-- It is the obvious constraint and it would be wrong. An amendment can be
-- repealed, and the article then returns to wording it already had — same text,
-- same fingerprint, a second time. A unique constraint would refuse to record
-- that, and "the article changed back on 12 March" is exactly the kind of fact
-- this table exists to still know in six months.
--
-- What a unique constraint was reaching for is worth keeping, though: a fetcher
-- that inserted on every probe rather than on every *change* would fill the
-- table with copies and make `observed_at desc` meaningless. That is a rule
-- about consecutive rows rather than about all rows, so it is a trigger — and a
-- `before` one, per ADR-0019, because the fetcher writes as `service_role` and
-- RLS does not apply to it at all.

create or replace function public.law_norm_revisions_guard_change ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest public.law_norm_revisions;
begin
  -- **The lock is the guard, and without it the rest is decoration.** Read
  -- committed is the default here, so two fetcher runs on one norm — an
  -- overlapping schedule, a retry after a timeout that had not actually failed,
  -- two instances of an edge function — each read a `latest` that does not
  -- include the other's uncommitted insert, each pass the comparison below, and
  -- both commit. The table then holds exactly the consecutive duplicate this
  -- trigger claims cannot exist, and the claim is what the reader of
  -- `observed_at desc` is relying on.
  --
  -- Locking the parent norm rather than the revisions serializes every writer
  -- for one norm while leaving different norms fully parallel, which is what the
  -- scheduler will actually do.
  perform 1 from public.law_norms where id = new.norm_id for update;

  select * into v_latest
  from public.law_norm_revisions
  where norm_id = new.norm_id
  order by observed_at desc, created_at desc, id desc
  limit 1;

  if not found then
    return new;
  end if;

  if v_latest.fingerprint = new.fingerprint
    and v_latest.normalizer_version = new.normalizer_version then
    raise exception
      'norm % already reads as % under normalizer %; a revision is recorded when the text changes, not when it is checked (§9.7)',
      new.norm_id, new.fingerprint, new.normalizer_version;
  end if;

  -- A recomputation under the same rules is not a recomputation. The label is
  -- the fetcher's to assert and this is the one form of it that is incoherent
  -- on its face — and it is worth refusing rather than storing, because a row
  -- claiming `renormalized` is a row ADM-45 will decline to raise a signal for.
  -- An amendment mislabelled this way is an amendment nobody is told about.
  if new.origin = 'renormalized'
    and v_latest.normalizer_version = new.normalizer_version then
    raise exception
      'norm % claims a renormalization under the same normalizer (%); nothing was recomputed',
      new.norm_id, new.normalizer_version;
  end if;

  return new;
end;
$$;

comment on function public.law_norm_revisions_guard_change () is
  'Refuses a revision identical to the norm''s current one. Consecutive duplicates only — an article reverting to earlier wording is a change and is recorded.';

create trigger law_norm_revisions_guard_change
before insert on public.law_norm_revisions
for each row execute function public.law_norm_revisions_guard_change ();

-- The register's fingerprint stops being independently writable ---------------
--
-- `law_norms.fingerprint` and this table are two statements of one fact, and the
-- register's whole design refuses that: staleness is derived rather than stored,
-- `probe_interval_hours` is `generated always` rather than maintained, and the
-- cadence cap is applied on read because no ordering of writes can outrun it.
--
-- The same argument applies here and could not be answered the same way — a
-- generated column cannot read another table. So it is answered with the next
-- best thing: the register's fingerprint is maintained *from* the log, by
-- trigger, and nothing else is expected to set it. Two rows that disagree about
-- what an article currently says is the one inconsistency this feature cannot
-- survive, because both readings look equally authoritative and the wrong one
-- produces a norm that never drifts.
--
-- **What this trigger deliberately does not touch: `state`, `last_checked_at`
-- and `last_verified_at`.** Those are the fetcher's, and two of them are
-- judgements rather than facts — §9.11's `drifted` says nobody has looked yet,
-- and only the fetcher knows whether a check happened at all. §9.10 exists
-- because "checked and unchanged" and "never successfully checked" must not be
-- rendered alike; a trigger that guessed at them would be the thing that made
-- them alike.

-- **And it adopts only a revision that is actually the newest.** The first
-- version of this trigger updated unconditionally, which is wrong for the case
-- the `observed_at` column was introduced to allow: a row inserted out of
-- order — a backfill from stored fixtures, a delayed retry, a second fetcher
-- finishing after a slower one it overtook — would have made the register claim
-- the article currently says something it stopped saying. That is the same
-- failure this trigger exists to prevent, reached from the other direction, and
-- it would look exactly like a correct register while a norm sat permanently
-- `drifted` against text nobody published any more.

create or replace function public.law_norms_adopt_revision ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_newest uuid;
begin
  select id into v_newest
  from public.law_norm_revisions
  where norm_id = new.norm_id
  order by observed_at desc, created_at desc, id desc
  limit 1;

  if v_newest is distinct from new.id then
    return null;
  end if;

  update public.law_norms
  set fingerprint = new.fingerprint,
      normalizer_version = new.normalizer_version
  where id = new.norm_id;

  return null;
end;
$$;

comment on function public.law_norms_adopt_revision () is
  'Carries a new revision onto the register, so law_norms.fingerprint cannot disagree with the revision log. Leaves state and the two timestamps to the fetcher.';

create trigger law_norms_adopt_revision
after insert on public.law_norm_revisions
for each row execute function public.law_norms_adopt_revision ();

-- Access ----------------------------------------------------------------------
--
-- **Read like the register.** §4.11 shows a lawyer a norm with every dependent
-- service against it, and the diff behind a signal is the same firm knowledge,
-- not one service's property. Both staff roles read all of it.
--
-- **Nobody writes it through the API.** There is no insert, update or delete
-- grant to `authenticated`, and that is the whole access design rather than an
-- omission: the only legitimate author is the fetcher, which runs as
-- `service_role` and bypasses RLS entirely (ADR-0019). Withholding the grant is
-- what makes a console write fail *loudly* — supabase/CLAUDE.md's point that a
-- denial under RLS is a silent empty result, and that the loud form is available
-- exactly where no authorised writer exists inside `authenticated`. Here none
-- does.
--
-- **No audit trigger, and this one is a judgement rather than an oversight.**
-- `audit_change` raises for a table it has no mapping for, so attaching the
-- trigger would have forced a decision either way; the decision is that a
-- revision is evidence, not an action. §6.1's log answers "who did what", and
-- the answer for every row here is "the scheduler, because the legislature
-- published something" — an actor that is null and a verb that is not a person's.
-- The change is audited regardless, one table across: `law_norms_adopt_revision`
-- moves the register's fingerprint, and `law_norms` is audited, so the event
-- lands with its before-and-after where a reader already looks for it.

alter table public.law_norm_revisions enable row level security;

grant select on table public.law_norm_revisions to authenticated;

-- The register's machine-written columns stop being hand-writable ---------------
--
-- `20260815140000` wrote `grant select, insert, update on table public.law_norms
-- to authenticated`, and a table-level `update` covers **every column**. That
-- was harmless while nothing wrote the machine columns; this migration makes
-- them derived, so it is now the hole underneath the derivation. Three columns
-- were reachable that should never have been, and one of them matters more than
-- the other two:
--
--   * `last_verified_at` — a lawyer with the console's own credentials could
--     `PATCH` a norm to look freshly verified when nothing had been checked at
--     all. §9.10 exists to make "no difference found" and "no check completed"
--     impossible to confuse, and `freshness.ts` computes the console's badge
--     straight from this column. A broken or unbuilt fetcher would render as a
--     quiet week — the exact failure, reachable by hand.
--   * `fingerprint` and `normalizer_version` — the previous section says the
--     register cannot disagree with the revision log. It could, by one `PATCH`.
--     A comment saying "nothing else is expected to set it" is not an
--     invariant; this is.
--
-- **Column-level `update` rather than a trigger**, because the refusal is then
-- a privilege error at the moment of the write instead of a rule the writer has
-- to read about, and because it needs no `security definer` function to be
-- correct. The cost is real and worth stating: a column added to `law_norms`
-- later is **not** granted by default, so a new editable field silently fails
-- for the console until it is added here. That is the safe direction to fail in
-- — a new field that cannot be saved is loud on first use, where a new
-- machine-written field that anyone can overwrite is silent forever.
--
-- The list below is what the console writes today (`probe_interval`,
-- `interval_reason` in `setCadence`) plus what §9.6 promises a lawyer — a wrong
-- citation can be corrected in place — plus `state`, which triage will move
-- (ADM-46). Nothing here is a narrowing of what a person could legitimately do.

revoke update on table public.law_norms from authenticated;

grant update (
  source,
  act_id,
  act_title,
  scope,
  article,
  act_scope_reason,
  source_url,
  canonical_url,
  probe_interval,
  interval_reason,
  state
) on table public.law_norms to authenticated;

create policy "law_norm_revisions_select_staff" on public.law_norm_revisions
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

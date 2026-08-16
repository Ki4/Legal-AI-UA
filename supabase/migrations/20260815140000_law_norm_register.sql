-- The law-reference register: a norm is watched once, and services depend on it
-- many times (ADM-21, spec §9.2-§9.4, §9.8, §9.10, §9.11, ADR-0011).
--
-- §8 sells a promise about legislation — a one-off document "valid until the
-- law changes", a subscription whose value is that documents stay current — and
-- §9 is the machinery that keeps it. This is the table that machinery watches.
-- Until now the promise rested on nothing at all.
--
-- Five rules the spec fixed before this table could exist, each one a line of
-- schema here rather than a paragraph somebody has to remember:
--
--   1. **A norm is watched once** (§9.3). `unique nulls not distinct (source,
--      act_id, article)`. Watching per citing service would mean ten fetches of
--      one text and ten possibly-diverging states for it, with no way to say
--      which is right. The dependency hangs off the norm instead, in
--      `service_law_refs`.
--   2. **The article is the unit; act-level is a marked exception** (§9.4).
--      Two check constraints, in both directions: an article-scoped row must
--      name an article, an act-scoped row must not, and must carry a reason. A
--      code has hundreds of articles and a template rests on a handful;
--      tracking the whole code fires on every amendment anywhere in it, and a
--      lawyer receiving mostly irrelevant alerts stops opening them — a failure
--      that leaves every indicator green.
--   3. **"Checked and unchanged" and "never successfully checked" are
--      different** (§9.10). Two timestamps, not one. A single `verified_at`
--      cannot say both, and a broken fetcher would then look exactly like
--      perfect order until a client noticed.
--   4. **Staleness is derived, never stored.** `stale by time` in §9.11's table
--      is `last_verified_at` plus an interval — a column holding it would be a
--      copy of the truth that drifts from it, which is the call `orders` made
--      about the same shape of question.
--   5. **Configuration cannot outrun the platform's own watch** (§9.8).
--      `effective_probe_interval` caps what the scheduler reads; the guard
--      below refuses the setting outright when it can see that it matters. Both
--      exist, and the reason is in the note on the cap.
--
-- **What Q4's answer changed.** §9.8 and §4.9 both phrase the interval cap as
-- "the detection window promised to clients". There is no such promise: the
-- product owner's answer to Q4 is that the client is told *that* a change was
-- found and that we are on it, not that it will be found within N days. So the
-- cap is not derived from a commitment — it is an internal operating maximum,
-- ours to revise, and `max_probe_interval` says so where it is defined. What
-- §9.8 was actually protecting survives intact: nobody can set a norm behind a
-- published service to a yearly probe and leave it effectively unwatched.
--
-- **Nothing fetches yet, on purpose.** The article fetcher is an edge function
-- (ADR-0020) and is the next pass; `fingerprint`, `last_checked_at` and the
-- three states between `drifted` and `impact_confirmed` are written by it. They
-- ship now for the same reason `orders` shipped a lifecycle nothing writes: the
-- states are settled spec, and retrofitting them means a migration plus a
-- screen that was designed without them.

-- Vocabulary ------------------------------------------------------------------

-- One value, and an enum rather than free text anyway. A second source is a
-- decision and a migration — which is exactly the weight it should carry, since
-- every parser assertion in §9.15 is written against one publisher's markup.
create type public.law_source as enum ('zakon_rada');

create type public.law_norm_scope as enum ('article', 'act');

-- §9.11 lists eight states. Six are stored and two are not, and the split is
-- the point rather than an omission:
--
--   `stale by time` is `last_verified_at + interval * a multiple` — derived, so
--   that it cannot disagree with the timestamps it is computed from.
--   `scheduled` is a property of a future-dated signal (ADM-47), which is a row
--   in a table that does not exist yet; storing it here would put the fact in
--   two places before the second one is even built.
--
-- `no impact` is absent for a different reason, and it is the interesting one.
-- §9.11 lists it as a state, but its own definition ends "re-fingerprint and
-- continue" — after which the fingerprint matches and the norm is `verified` by
-- definition. Two simultaneously-true states is precisely the second answer
-- §6.1 refuses. The judgement is not lost: marking a drift as harmless is an
-- update to this row, so it lands in `audit_events` with its author and its
-- before-and-after, which is what §9.11 asks for when it says the decision is
-- recorded rather than treated as housekeeping.
create type public.law_norm_state as enum (
  -- Entered, never successfully fetched. The state every norm starts in, and
  -- today the only one any of them can be in.
  'unverified',
  -- The fingerprint matches the last confirmed revision.
  'verified',
  -- The fingerprint moved and nobody has looked yet.
  'drifted',
  'under_review',
  -- It changes the document; a new template version is owed.
  'impact_confirmed',
  -- Fetching is failing. Never "no change" — §9.10, §9.15.
  'unreachable'
);

-- The operating maximum -------------------------------------------------------

-- **Not a promise to anybody.** Q4 was answered as a format rather than a
-- deadline: we tell a client that a change was found and that we are acting on
-- it, and we do not commit to a number of days. This is the engineering bound
-- underneath that — how stale the platform is prepared to let its own watch of
-- a live service become — and it is ours to change without renegotiating
-- anything.
--
-- A function rather than a literal because three places need it: the guard, the
-- effective interval the scheduler will read, and `verify_law_refs.sql`. Three
-- copies of a number is three numbers, eventually.
create or replace function public.max_probe_interval ()
returns interval
language sql
immutable
as $$
  select interval '7 days';
$$;

comment on function public.max_probe_interval () is
  'Internal operating maximum for a norm behind a published service. Not a client commitment — Q4 was answered as a format, not a deadline.';

grant execute on function public.max_probe_interval () to authenticated;

-- The register ----------------------------------------------------------------

create table public.law_norms (
  id uuid primary key default gen_random_uuid (),

  source public.law_source not null,

  -- The act as its publisher names it: `2947-14`, `z0123-19`, `254к/96-вр`.
  -- Normalized and lowercased by `@legal-ai/law-refs` before it arrives, which
  -- is what makes the unique constraint below mean what it says.
  act_id text not null check (length(btrim(act_id)) > 0),

  -- For a person to read. The identifier is not one.
  act_title text not null check (length(btrim(act_title)) > 0),

  scope public.law_norm_scope not null default 'article',

  -- Rule 2. Null exactly when the scope is the whole act.
  article text,

  -- Rule 2's other half: an act-level choice is explicit and justified (§9.4).
  -- Sometimes the dependency really is on a whole new act, and forcing an
  -- invented article number is worse than an honest "whole act, noise
  -- expected" — but only when somebody wrote down which of the two this is.
  act_scope_reason text,

  -- §9.2: kept for display only, never fetched. The lawyer recognizes what they
  -- pasted; the platform watches `canonical_url`.
  source_url text not null check (length(btrim(source_url)) > 0),

  -- The "whatever is currently in force" pointer. This is what gets fetched.
  canonical_url text not null check (length(btrim(canonical_url)) > 0),

  -- §9.8, per norm, with a recommended default a person may override. The
  -- override costs a sentence — see the guard.
  -- The default matches what `recommended_probe_interval` returns for a norm
  -- with no dependencies yet, which is every norm at the moment it is inserted.
  -- So an insert that says nothing about cadence is, by construction, taking
  -- the recommendation — and owes no reason for it.
  probe_interval interval not null default interval '7 days',
  interval_reason text,

  -- The same cadence as a number of hours, so the console needs no interval
  -- parser: PostgREST hands `interval` over as Postgres prints it — `7 days`,
  -- `06:00:00`, `1 day 06:00:00` — and a screen that has to compute staleness
  -- from that is a screen with a date library's worth of parsing in it.
  --
  -- A second representation of one fact is normally exactly what this schema
  -- refuses. It is allowed here because `generated always ... stored` is the one
  -- form that cannot drift: Postgres recomputes it on every write and there is
  -- no path that sets it.
  probe_interval_hours numeric
    generated always as (extract(epoch from probe_interval) / 3600) stored,

  state public.law_norm_state not null default 'unverified',

  -- Rule 3 and §9.7. A hash of the normalized article text, null until the
  -- first successful fetch. A date says only that somebody looked; this says
  -- whether what they looked at is still the same thing.
  fingerprint text,

  -- Which normalization produced that hash. Without it, changing our own
  -- whitespace rules moves every fingerprint at once and two hundred norms go
  -- `drifted` on the same morning with no way to tell our edit from the
  -- legislature's — the silent-failure shape §9.15 is written against.
  normalizer_version integer not null default 1,

  -- Rule 3. The attempt, and the attempt that succeeded and matched. They are
  -- different questions and a screen that renders one for the other tells a
  -- lawyer a broken fetcher is a quiet week.
  last_checked_at timestamptz,
  last_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Rule 1, as a constraint rather than a convention. `nulls not distinct` so
  -- that two act-scoped rows for one act collide too — without it, the null
  -- article would make every act-level row unique against every other.
  constraint law_norms_watched_once unique nulls not distinct (source, act_id, article),

  constraint law_norms_article_scope check (
    (scope = 'article' and article is not null and length(btrim(article)) > 0)
    or (scope = 'act' and article is null)
  ),

  constraint law_norms_act_scope_reason check (
    (scope = 'act' and act_scope_reason is not null and length(btrim(act_scope_reason)) > 0)
    or (scope = 'article' and act_scope_reason is null)
  )
);

comment on table public.law_norms is
  'A watched norm. Watched once and depended on many times (§9.3); the pasted URL is display-only and canonical_url is what is fetched.';

comment on column public.law_norms.article is
  'Null exactly when scope = act. A part or point of an article belongs in service_law_refs.relied_on — the article is the tracked unit (§9.4).';

comment on column public.law_norms.fingerprint is
  'Hash of the normalized article text (§9.7). Null until a successful fetch — which no code performs yet; the fetcher is ADR-0020.';

comment on column public.law_norms.last_verified_at is
  'The last check that succeeded AND matched. Distinct from last_checked_at on purpose: §9.10 refuses to render "no difference found" and "no check completed" alike.';

create index law_norms_by_act on public.law_norms (source, act_id);

-- The scheduler (ADM-44) reads this one: what is due, oldest first. Nulls sort
-- first under `asc nulls first`, which is right — a norm never verified is the
-- most overdue thing in the table, not the least.
create index law_norms_by_verification on public.law_norms (last_verified_at asc nulls first);

create trigger law_norms_touch_updated_at
before update on public.law_norms
for each row execute function public.touch_updated_at ();

-- The dependency --------------------------------------------------------------

create table public.service_law_refs (
  id uuid primary key default gen_random_uuid (),

  service_id uuid not null references public.services (id) on delete cascade,

  -- `restrict`, and this is the half that makes sharing safe: a norm somebody
  -- depends on cannot be deleted out from under them. Dropping the dependency
  -- is a delete of this row; dropping the norm is only possible once nothing
  -- points at it.
  norm_id uuid not null references public.law_norms (id) on delete restrict,

  -- §9.5.6, and `not null` deliberately. "Write one line about what you relied
  -- on" — "grounds for dissolution of marriage". When a diff arrives in six
  -- months this sentence is the whole of what tells the reader whether the
  -- change matters. Nullable would make it optional, and optional means empty
  -- everywhere by the time it is needed.
  relied_on text not null check (length(btrim(relied_on)) > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_law_refs_once_per_service unique (service_id, norm_id)
);

comment on table public.service_law_refs is
  'This service relies on this norm. Hangs off the register rather than duplicating it (§9.3); relied_on is what makes a future diff readable.';

comment on column public.service_law_refs.relied_on is
  'One line on what the service leans on this norm for. Also where a specific part or point goes — the article is what is tracked (§9.4).';

create index service_law_refs_by_norm on public.service_law_refs (norm_id);

create trigger service_law_refs_touch_updated_at
before update on public.service_law_refs
for each row execute function public.touch_updated_at ();

-- Cadence ---------------------------------------------------------------------
--
-- `security definer` on the two that read other tables, for the reason ADR-0019
-- gives about guards generally: a function running as its caller sees only what
-- the caller may see, and a guard that reads less than the truth fails in two
-- directions — refusing correct writes, and passing wrong ones when a narrowed
-- read leaves a comparison against null. What they return is catalogue: whether
-- a service is on sale. Every member of staff may already read that.

create or replace function public.norm_behind_published_service (target_norm uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_law_refs r
    join public.service_versions sv on sv.service_id = r.service_id
    where r.norm_id = target_norm and sv.status = 'published'
  );
$$;

comment on function public.norm_behind_published_service (uuid) is
  'Whether any service on sale depends on this norm. Decides the recommended cadence and whether the operating maximum binds.';

revoke all on function public.norm_behind_published_service (uuid) from public, anon;
grant execute on function public.norm_behind_published_service (uuid) to authenticated;

-- §9.8's table: daily behind a published service, weekly for norms used only by
-- drafts. No adaptive frequency — an act untouched for three years and then
-- amended is precisely the dangerous case, and adaptive cadence is asleep for
-- it (§9.8). This is a function of what the norm is *for*, not of how often it
-- has moved.
create or replace function public.recommended_probe_interval (target_norm uuid)
returns interval
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.norm_behind_published_service (target_norm) then interval '1 day'
    else interval '7 days'
  end;
$$;

comment on function public.recommended_probe_interval (uuid) is
  'What §9.8 proposes for this norm: daily behind a published service, weekly otherwise. A person may override it, with a reason.';

revoke all on function public.recommended_probe_interval (uuid) from public, anon;
grant execute on function public.recommended_probe_interval (uuid) to authenticated;

-- What the scheduler will actually read (ADM-44), and the reason the guard
-- below is not the only defence.
--
-- The guard can only refuse a configuration it can see is wrong at the moment
-- of the write. Three orderings slip past it: a slow interval set while the
-- norm has no dependencies at all, a dependency added afterwards, and — the one
-- no trigger on these two tables can ever catch — a service being *published*
-- later, which changes the answer without touching either table. So the cap is
-- applied where it cannot be outrun: on read, by construction. The stored
-- column keeps what the lawyer asked for, and the scheduler is handed what the
-- platform will actually honour.
create or replace function public.effective_probe_interval (target_norm uuid)
returns interval
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.norm_behind_published_service (target_norm)
      then least(n.probe_interval, public.max_probe_interval ())
    else n.probe_interval
  end
  from public.law_norms n
  where n.id = target_norm;
$$;

comment on function public.effective_probe_interval (uuid) is
  'The cadence the platform honours, with the operating maximum applied. Derived rather than stored, so no ordering of writes can outrun it.';

revoke all on function public.effective_probe_interval (uuid) from public, anon;
grant execute on function public.effective_probe_interval (uuid) to authenticated;

-- Guards ----------------------------------------------------------------------

create or replace function public.law_norms_guard_cadence ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chosen boolean;
begin
  if new.probe_interval <= interval '0 seconds' then
    raise exception 'a probe interval is a positive amount of time';
  end if;

  -- Only the *act of choosing* is asked for a reason. Comparing against the
  -- recommendation on every update would demand a rationale from whoever next
  -- edits the act title, because the recommendation moves on its own the moment
  -- a service depending on this norm is published — and the lawyer being asked
  -- would not be the one who chose anything.
  v_chosen := tg_op = 'INSERT' or new.probe_interval is distinct from old.probe_interval;

  if v_chosen
    and new.probe_interval is distinct from public.recommended_probe_interval (new.id)
    and (new.interval_reason is null or length(btrim(new.interval_reason)) = 0) then
    raise exception 'a tracking interval other than the recommended one is recorded with its reason (§9.8)';
  end if;

  -- §4.9, as the refusal a lawyer actually meets: "I cannot set an interval
  -- that would break the promise". `effective_probe_interval` already
  -- guarantees the platform honours the cap whatever is stored here, so this is
  -- not the rule's enforcement — it is the rule being *visible* at the moment
  -- somebody tries, rather than silently overridden later.
  if v_chosen
    and new.probe_interval > public.max_probe_interval ()
    and public.norm_behind_published_service (new.id) then
    raise exception
      'a service on sale depends on this norm; it is probed at least every %, not every %',
      public.max_probe_interval (), new.probe_interval;
  end if;

  return new;
end;
$$;

create trigger law_norms_guard_cadence
before insert or update on public.law_norms
for each row execute function public.law_norms_guard_cadence ();

-- The other ordering the guard above can see: the interval was fine while
-- nothing on sale depended on the norm, and now something does.
create or replace function public.service_law_refs_guard_cadence ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interval interval;
  v_published boolean;
begin
  select n.probe_interval into v_interval
  from public.law_norms n where n.id = new.norm_id;

  select exists (
    select 1 from public.service_versions sv
    where sv.service_id = new.service_id and sv.status = 'published'
  ) into v_published;

  if v_published and v_interval > public.max_probe_interval () then
    raise exception
      'norm % is probed every %; a service on sale cannot depend on a norm probed less often than every %',
      new.norm_id, v_interval, public.max_probe_interval ();
  end if;

  return new;
end;
$$;

create trigger service_law_refs_guard_cadence
before insert or update on public.service_law_refs
for each row execute function public.service_law_refs_guard_cadence ();

-- Audit -----------------------------------------------------------------------
--
-- `audit_change` raises for a table it has no mapping for, so the mapping
-- cannot be forgotten — which is the only reason this whole function is
-- restated here rather than a line being added somewhere.
--
-- The two tables map differently, and the difference is the §6.2 cut each one
-- belongs in. A dependency is about one service, so its events land in the
-- assigned lawyer's log — a lawyer answering for a service should see a norm
-- being attached to or detached from it. The register itself belongs to no
-- service: ten services may depend on one norm, and there is no honest
-- `service_id` to write. It logs with null, like the client tables, which puts
-- register edits in the admin cut. The lawyer's view of a norm moving is the
-- signal (ADM-46), not the register's edit history.

create or replace function public.audit_change ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_changed text[];
  v_entity uuid;
  v_service uuid;
  v_redacted text;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_before := to_jsonb(old);
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);

    select array_agg(k order by k) into v_changed
    from jsonb_object_keys(v_after) as k
    where v_after -> k is distinct from v_before -> k;

    if v_changed is null then
      return null;
    end if;
  end if;

  v_row := coalesce(v_after, v_before);

  case tg_table_name
    when 'services' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := v_entity;
    when 'service_versions' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := (v_row ->> 'service_id')::uuid;
    when 'questionnaire_fields' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := (v_row ->> 'service_id')::uuid;
    when 'service_version_prices' then
      v_entity := (v_row ->> 'service_version_id')::uuid;
      select sv.service_id into v_service
      from public.service_versions sv where sv.id = v_entity;
    when 'service_assignments' then
      v_entity := (v_row ->> 'service_id')::uuid;
      v_service := v_entity;
    when 'clients' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := null;
    when 'client_identities' then
      v_entity := (v_row ->> 'client_id')::uuid;
      v_service := null;
    when 'plan_services' then
      v_entity := (v_row ->> 'service_id')::uuid;
      v_service := v_entity;
    when 'entitlements' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := null;
    when 'entitlement_services' then
      v_entity := (v_row ->> 'entitlement_id')::uuid;
      v_service := null;
    when 'orders' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := public.version_service ((v_row ->> 'service_version_id')::uuid);
    when 'law_norms' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := null;
    when 'service_law_refs' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := (v_row ->> 'service_id')::uuid;
    else
      raise exception 'audit_change has no entity mapping for table %', tg_table_name;
  end case;

  if tg_nargs > 0 then
    foreach v_redacted in array tg_argv loop
      v_before := v_before - v_redacted;
      v_after := v_after - v_redacted;
    end loop;
  end if;

  insert into public.audit_events
    (actor_id, actor_role, service_id, action, entity_table, entity_id,
     changed_columns, before, after)
  values
    (auth.uid (), public.jwt_role (), v_service, lower(tg_op)::public.audit_action,
     tg_table_name, v_entity, v_changed, v_before, v_after);

  return null;
end;
$$;

create trigger law_norms_audit
after insert or update or delete on public.law_norms
for each row execute function public.audit_change ();

create trigger service_law_refs_audit
after insert or update or delete on public.service_law_refs
for each row execute function public.audit_change ();

-- Access ----------------------------------------------------------------------
--
-- The register is firm knowledge rather than one service's property, so both
-- staff roles read all of it — §4.11 shows a lawyer a norm once with every
-- dependent service listed against it, which is not a screen that can be built
-- out of rows filtered to their own assignments.
--
-- Writing splits differently. Adding a norm is open to both roles, because a
-- lawyer cannot record a dependency without the norm existing and a register
-- only an admin may extend is a register that stays empty. Changing one is not:
-- a norm is shared, so editing its cadence or its identity reaches every
-- service depending on it. An admin may; a lawyer may when they are assigned to
-- one of those services, which is the same predicate `orders_select_staff`
-- uses and for the same reason.
--
-- **No delete policy on `law_norms`, and no delete grant.** The `restrict` on
-- the dependency already refuses to delete a norm in use; what this refuses is
-- deleting the ones that are not. A norm that stops being depended on still
-- carries the fingerprint history and the audit trail of what it was — and
-- ADM-24's impact index has to answer "which issued documents rested on this"
-- long after the last service stopped citing it.

alter table public.law_norms enable row level security;
alter table public.service_law_refs enable row level security;

grant select, insert, update on table public.law_norms to authenticated;
grant select, insert, update, delete on table public.service_law_refs to authenticated;

create policy "law_norms_select_staff" on public.law_norms
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "law_norms_insert_staff" on public.law_norms
  for insert to authenticated
  with check (public.jwt_role () in ('admin', 'lawyer'));

create policy "law_norms_update_admin_or_dependent_lawyer" on public.law_norms
  for update to authenticated
  using (
    public.jwt_role () = 'admin'
    or (
      public.jwt_role () = 'lawyer'
      and exists (
        select 1 from public.service_law_refs r
        where r.norm_id = law_norms.id and public.is_assigned_to (r.service_id)
      )
    )
  )
  with check (
    public.jwt_role () = 'admin'
    or (
      public.jwt_role () = 'lawyer'
      and exists (
        select 1 from public.service_law_refs r
        where r.norm_id = law_norms.id and public.is_assigned_to (r.service_id)
      )
    )
  );

create policy "service_law_refs_select_staff" on public.service_law_refs
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

-- Who may say what a service rests on is who answers for the service. Three
-- separate policies rather than `for all`, because the `using`/`with check`
-- split differs: an insert has no old row to test, and a delete has no new one.
create policy "service_law_refs_insert_staff" on public.service_law_refs
  for insert to authenticated
  with check (
    public.jwt_role () = 'admin'
    or (public.jwt_role () = 'lawyer' and public.is_assigned_to (service_id))
  );

create policy "service_law_refs_update_staff" on public.service_law_refs
  for update to authenticated
  using (
    public.jwt_role () = 'admin'
    or (public.jwt_role () = 'lawyer' and public.is_assigned_to (service_id))
  )
  with check (
    public.jwt_role () = 'admin'
    or (public.jwt_role () = 'lawyer' and public.is_assigned_to (service_id))
  );

create policy "service_law_refs_delete_staff" on public.service_law_refs
  for delete to authenticated
  using (
    public.jwt_role () = 'admin'
    or (public.jwt_role () = 'lawyer' and public.is_assigned_to (service_id))
  );

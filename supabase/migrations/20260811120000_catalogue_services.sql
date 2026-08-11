-- Catalogue: services, their versions, and per-currency prices.
--
-- Two rules from ADR-0009 are enforced here by triggers rather than by RLS,
-- because service_role bypasses RLS and would otherwise be able to rewrite
-- published content:
--
--   1. A version is frozen from the moment it is published. Its content can
--      never change again; only its status may move (publish → pause →
--      archive). "Editing a live service" is not an operation that exists.
--   2. One version holds the live slot at a time. Publishing a new version
--      archives whichever version held the slot before it.
--
-- Everything that varies over time — modes, price, status — lives on the
-- version. The service itself keeps a stable identity so an issued document
-- can pin a version id whose meaning never drifts.
--
-- Access follows ADR-0014: the catalogue is platform data, not case data, so
-- role is the right instrument here. Client-bearing tables land in a later
-- migration and key on assignment instead.
--
-- Within that, the split is commercial versus professional rather than
-- senior versus junior. An admin decides what is on sale, at what price, and
-- when it is published. The assigned lawyer owns the draft of the service
-- they are accountable for. Neither can do the other's half.

create type public.service_status as enum (
  'draft',
  'in_review',
  'published',
  'paused',
  'archived'
);

create type public.generation_mode as enum ('template', 'block_assembly', 'full_generation');

create type public.review_mode as enum ('auto', 'lawyer_required');

-- Role lives in JWT app_metadata, which is server-set only (see the auth
-- migration). Wrapping the lookup keeps every policy below reading the same
-- way, and lets the planner cache it.
create or replace function public.jwt_role ()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.jwt () -> 'app_metadata' ->> 'role';
$$;

create or replace function public.touch_updated_at ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Services ------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid (),
  slug text not null unique,
  title text not null,
  summary text,
  assigned_lawyer_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.services is
  'A catalogue entry with a stable identity. Everything that varies over time lives on service_versions.';

comment on column public.services.assigned_lawyer_id is
  'Nullable while a service is a draft. Publication requires it — every service has an assigned lawyer.';

create trigger services_touch_updated_at
before update on public.services
for each row execute function public.touch_updated_at ();

alter table public.services enable row level security;

grant select, insert, update, delete on table public.services to authenticated;

create policy "services_select_staff" on public.services
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "services_write_admin" on public.services
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

-- The assigned lawyer edits the service they are accountable for. What they
-- may not touch is the commercial side: the slug a client's link depends on,
-- and who the service is assigned to. WITH CHECK already stops them reassigning
-- it away from themselves; the trigger below covers the slug and, more
-- usefully, fails with a sentence instead of an empty result set.
create policy "services_update_assigned_lawyer" on public.services
  for update to authenticated
  using (
    public.jwt_role () = 'lawyer'
    and assigned_lawyer_id = auth.uid ()
  )
  with check (
    public.jwt_role () = 'lawyer'
    and assigned_lawyer_id = auth.uid ()
  );

create or replace function public.services_guard_catalogue_columns ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Guard on the lawyer role explicitly rather than on "not admin": outside a
  -- request there is no JWT at all, and a migration or a seed running as
  -- postgres must not be caught by this.
  if public.jwt_role () = 'lawyer' then
    if new.slug is distinct from old.slug then
      raise exception 'the slug is a catalogue decision; ask an admin to change it';
    end if;
    if new.assigned_lawyer_id is distinct from old.assigned_lawyer_id then
      raise exception 'reassigning a service is an admin operation';
    end if;
  end if;

  return new;
end;
$$;

create trigger services_guard_catalogue_columns
before update on public.services
for each row execute function public.services_guard_catalogue_columns ();

-- Service versions ----------------------------------------------------------

create table public.service_versions (
  id uuid primary key default gen_random_uuid (),
  service_id uuid not null references public.services (id) on delete cascade,
  version integer not null check (version > 0),
  status public.service_status not null default 'draft',
  generation_mode public.generation_mode not null,
  review_mode public.review_mode not null,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (service_id, version),
  -- ADR-0005: the two modes are independent axes, but not symmetric. Only
  -- `template` may run unreviewed; anything the AI assembles or writes is
  -- always lawyer_required. The ADR asks for this on the data model rather
  -- than in application logic precisely so a misconfigured version cannot
  -- put unreviewed AI-written legal text in front of a client.
  constraint service_versions_review_follows_generation check (
    generation_mode = 'template' or review_mode = 'lawyer_required'
  )
);

comment on table public.service_versions is
  'Frozen once published (ADR-0009). Exactly one version per service holds the live slot.';

-- The live slot is published *or* paused: a paused version is still the one
-- clients would be served, it has merely stopped accepting orders.
create unique index service_versions_one_live_per_service
  on public.service_versions (service_id)
  where status in ('published', 'paused');

-- Freeze. Runs before the publish trigger below — Postgres fires BEFORE
-- triggers in name order, and "freeze" sorts before "publish", so the first
-- publication passes through (published_at is still null at that point) and
-- every later update is checked.
create or replace function public.service_versions_freeze ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is null then
    return new;
  end if;

  if new.service_id is distinct from old.service_id
    or new.version is distinct from old.version
    or new.generation_mode is distinct from old.generation_mode
    or new.review_mode is distinct from old.review_mode
    or new.published_at is distinct from old.published_at
    or new.published_by is distinct from old.published_by then
    raise exception 'service version % is published; its content is frozen (ADR-0009)', old.id;
  end if;

  return new;
end;
$$;

create trigger service_versions_freeze
before update on public.service_versions
for each row execute function public.service_versions_freeze ();

create or replace function public.service_versions_no_delete_published ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null then
    raise exception 'service version % is published and cannot be deleted (ADR-0009)', old.id;
  end if;
  return old;
end;
$$;

create trigger service_versions_no_delete_published
before delete on public.service_versions
for each row execute function public.service_versions_no_delete_published ();

-- Publication: archive the predecessor, stamp who and when, refuse to publish
-- a service nobody is accountable for.
--
-- The sibling UPDATE runs as the caller and is therefore subject to RLS. That
-- is intentional: only an admin can reach this path at all, and the admin
-- policy covers every row, so the archive always lands. A SECURITY DEFINER
-- here would buy nothing and would bypass RLS for the whole statement.
create or replace function public.service_versions_publish ()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Branch on tg_op rather than leaning on `or` to guard the OLD reference:
  -- SQL's OR does not promise short-circuit evaluation, and OLD is unassigned
  -- in a BEFORE INSERT trigger.
  takes_live_slot boolean;
  first_publication boolean;
begin
  if tg_op = 'INSERT' then
    takes_live_slot := new.status in ('published', 'paused');
    first_publication := new.status = 'published';
  else
    takes_live_slot := new.status in ('published', 'paused')
      and old.status is distinct from new.status;
    first_publication := new.status = 'published' and old.published_at is null;
  end if;

  if takes_live_slot then
    update public.service_versions
    set status = 'archived'
    where service_id = new.service_id
      and id is distinct from new.id
      and status in ('published', 'paused');
  end if;

  if first_publication then
    if not exists (
      select 1 from public.services s
      where s.id = new.service_id and s.assigned_lawyer_id is not null
    ) then
      raise exception 'cannot publish a version of a service with no assigned lawyer';
    end if;

    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(new.published_by, auth.uid ());
  end if;

  return new;
end;
$$;

create trigger service_versions_publish
before insert or update on public.service_versions
for each row execute function public.service_versions_publish ();

alter table public.service_versions enable row level security;

grant select, insert, update, delete on table public.service_versions to authenticated;

create policy "service_versions_select_staff" on public.service_versions
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "service_versions_write_admin" on public.service_versions
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

-- The assigned lawyer owns the draft. They may create one, edit its modes, and
-- move it between draft and in_review — but the live slot is not theirs to
-- take: `status` is fenced to the pre-publication values, which also keeps
-- them out of the archive-the-predecessor path. Publication, pause and price
-- stay with the admin.
--
-- `review_mode` is deliberately inside their reach. They are the only person
-- who can judge whether a document needs a lawyer in the loop, and routing
-- that decision through an admin puts a non-expert in the one place ADR-0005
-- cares about.
create policy "service_versions_write_assigned_lawyer" on public.service_versions
  for all to authenticated
  using (
    public.jwt_role () = 'lawyer'
    and published_at is null
    and exists (
      select 1 from public.services s
      where s.id = service_id and s.assigned_lawyer_id = auth.uid ()
    )
  )
  with check (
    public.jwt_role () = 'lawyer'
    and published_at is null
    and status in ('draft', 'in_review')
    and exists (
      select 1 from public.services s
      where s.id = service_id and s.assigned_lawyer_id = auth.uid ()
    )
  );

-- Prices --------------------------------------------------------------------
--
-- A row per currency, not a column pair (spec §8.6). We sell in UAH; EUR is
-- plausible later, and a published version is frozen, so a currency that
-- arrived after publication could not be added without breaking the freeze.
-- Amounts are integer minor units: 550000 + 'UAH' is 5 500,00 ₴.

create table public.service_version_prices (
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  primary key (service_version_id, currency)
);

comment on table public.service_version_prices is
  'Integer minor units per currency. Frozen with its version — see service_version_prices_freeze.';

create or replace function public.service_version_prices_freeze ()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Both sides are checked on UPDATE, so a price cannot be moved off a
  -- published version either. OLD and NEW are each unassigned in one of the
  -- three operations, hence the explicit branching.
  frozen uuid;
begin
  if tg_op <> 'INSERT' then
    select v.id into frozen
    from public.service_versions v
    where v.id = old.service_version_id and v.published_at is not null;
  end if;

  if frozen is null and tg_op <> 'DELETE' then
    select v.id into frozen
    from public.service_versions v
    where v.id = new.service_version_id and v.published_at is not null;
  end if;

  if frozen is not null then
    raise exception 'service version % is published; its prices are frozen (ADR-0009)', frozen;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger service_version_prices_freeze
before insert or update or delete on public.service_version_prices
for each row execute function public.service_version_prices_freeze ();

alter table public.service_version_prices enable row level security;

grant select, insert, update, delete on table public.service_version_prices to authenticated;

create policy "service_version_prices_select_staff" on public.service_version_prices
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "service_version_prices_write_admin" on public.service_version_prices
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

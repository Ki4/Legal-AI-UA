-- A problem with a live service is a pause with a reason. Spec §5.7, ADM-72.
--
-- Until now a pause was a status flip: `service_versions.status = 'paused'`,
-- set by an admin or by a confirmed law impact (ADM-53), and the reason lived
-- nowhere. §5.7 makes it a row, because the reason decides three things the
-- status cannot — who may open it, who may close it, and whose question it is
-- afterwards:
--
--   reason        opened by                          closed by
--   law_impact    the system, or a lawyer            a signatory, or the fix going on sale
--   defect        signatory, accountable, admin      a signatory, or the fix going on sale
--   generation    signatory, accountable, reviewer   a signatory, or the fix going on sale
--   no_reviewer   signatory, accountable, admin      a signatory
--   commercial    admin                              admin
--
-- Stopping is open to everyone accountable and starting is not: a professional
-- pause is lifted by a signatory of the area or by publishing the fix, never
-- by an admin, and a commercial one is the admin's alone.
--
-- Three consequences are on the data model here, because they are the ones a
-- screen could forget:
--
--   1. The version's `paused` status follows the row. A status flip with no
--      row behind it is refused; closing the row is what puts the version back
--      on sale (`resumed`) or into the archive (`archived`, `new_version`).
--   2. Publishing the fix closes the pause. The publish trigger already
--      archives the live predecessor; it now also closes that predecessor's
--      open pause with `new_version` and the fix's id, in the same act.
--   3. Orders in flight on a version paused for `defect`, `law_impact` or
--      `generation` are not delivered unreviewed, whatever the version's
--      `review_mode`. A document from a version known to be wrong does not
--      leave the building on autopilot — and that holds after the pause closes
--      too, unless it closed as `resumed` (a false alarm).
--
-- ADM-53's trigger is restated to open a `law_impact` row per affected version
-- instead of flipping the status, with the signal on the row, so the intake bot
-- can name the act (Q5) and the timeline can show why (§4.8).

create type public.pause_reason as enum (
  'law_impact',
  'defect',
  'generation',
  'no_reviewer',
  'commercial'
);

create type public.pause_resolution as enum (
  'new_version',
  'resumed',
  'archived'
);

create table public.service_pauses (
  id uuid primary key default gen_random_uuid (),
  service_version_id uuid not null references public.service_versions (id) on delete restrict,
  reason public.pause_reason not null,
  -- Internal. The client-safe sentence is a dictionary key per reason (§5.7),
  -- never this column.
  note text,
  -- The signal that opened a `law_impact` pause, so "this act changed it" has
  -- something to point at.
  signal_id uuid references public.law_signals (id) on delete restrict,
  opened_by uuid,
  opened_at timestamptz not null default now(),
  closed_by uuid,
  closed_at timestamptz,
  resolution public.pause_resolution,
  -- The version that took over, for `new_version`.
  replaced_by uuid references public.service_versions (id) on delete restrict,
  -- §5.7 point 3: whether the holders of issued documents were told is a
  -- signatory's call on a `defect`, and the call is recorded either way — a
  -- timestamp here, or the note saying why not.
  holders_notified_at timestamptz,

  constraint service_pauses_closed_has_resolution check (
    (closed_at is null) = (resolution is null)
  ),
  constraint service_pauses_new_version_names_it check (
    resolution is distinct from 'new_version' or replaced_by is not null
  ),
  constraint service_pauses_replaced_by_means_new_version check (
    replaced_by is null or resolution = 'new_version'
  ),
  constraint service_pauses_signal_is_law_impact check (
    signal_id is null or reason = 'law_impact'
  )
);

comment on table public.service_pauses is
  'Why a version is off sale, who stopped it, who may start it (§5.7). One open row per version; the version''s paused status follows the row.';

create unique index service_pauses_one_open
  on public.service_pauses (service_version_id)
  where closed_at is null;

create index service_pauses_by_version
  on public.service_pauses (service_version_id, opened_at);

-- Who may open, who may close --------------------------------------------------------

create or replace function public.service_pauses_guard ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_service uuid;
  v_area text;
  v_status public.service_status;
  v_fix_publishing boolean;
begin
  v_role := public.jwt_role ();
  v_fix_publishing := coalesce(current_setting('legal_ai.fix_publishing', true), '') = 'on';

  select sv.service_id, sv.status, s.practice_area
  into v_service, v_status, v_area
  from public.service_versions sv
  join public.services s on s.id = sv.service_id
  where sv.id = new.service_version_id;

  if tg_op = 'INSERT' then
    if v_status not in ('published', 'paused') then
      raise exception
        'only a version on sale is paused; % is %', new.service_version_id, v_status;
    end if;

    if new.closed_at is not null or new.closed_by is not null or new.resolution is not null then
      raise exception 'a pause opens open; close it with a second statement';
    end if;

    new.opened_by := coalesce(new.opened_by, auth.uid ());

    -- Outside a request — a seed, a migration, the law-signal trigger running
    -- as service_role — there is no role to hold this to.
    if v_role is not null then
      if new.reason = 'commercial' then
        if v_role <> 'admin' then
          raise exception 'a commercial pause is an admin''s decision';
        end if;
      elsif v_role = 'admin' then
        null;
      elsif v_role = 'lawyer' then
        if not (
          public.signs_for_area (v_area)
          or public.is_primary_for (v_service)
          or (new.reason = 'generation' and exists (
            select 1 from public.orders o
            where o.service_version_id = new.service_version_id
              and o.reviewer_id = auth.uid ()
          ))
        ) then
          raise exception
            'pausing % is for its signatories, its accountable lawyer or an admin', v_service;
        end if;
      else
        raise exception 'only staff pause a service';
      end if;
    end if;

    return new;
  end if;

  -- UPDATE. What was recorded at opening is history.
  if new.service_version_id is distinct from old.service_version_id
    or new.reason is distinct from old.reason
    or new.signal_id is distinct from old.signal_id
    or new.opened_by is distinct from old.opened_by
    or new.opened_at is distinct from old.opened_at then
    raise exception 'a pause''s opening is on the record; it does not change';
  end if;

  if old.closed_at is not null then
    if new.closed_at is distinct from old.closed_at
      or new.closed_by is distinct from old.closed_by
      or new.resolution is distinct from old.resolution
      or new.replaced_by is distinct from old.replaced_by
      or new.note is distinct from old.note
      or new.holders_notified_at is distinct from old.holders_notified_at then
      raise exception 'a closed pause is history';
    end if;
    return new;
  end if;

  if new.closed_at is not null then
    new.closed_by := coalesce(new.closed_by, auth.uid ());

    if v_role is not null and not v_fix_publishing then
      if old.reason = 'commercial' then
        if v_role <> 'admin' then
          raise exception 'a commercial pause is lifted by an admin';
        end if;
      elsif new.resolution = 'new_version' then
        raise exception
          'a pause closes as new_version only by the fix going on sale (§5.7)';
      elsif not (v_role = 'lawyer' and public.signs_for_area (v_area)) then
        raise exception
          'a % pause is lifted by a signatory of % or by the fix going on sale, never by an admin',
          old.reason, v_area;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger service_pauses_guard
before insert or update on public.service_pauses
for each row execute function public.service_pauses_guard ();

-- The version follows the row ---------------------------------------------------------

create or replace function public.service_pauses_apply ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('legal_ai.pause_row', 'on', true);

  if tg_op = 'INSERT' then
    update public.service_versions
    set status = 'paused'
    where id = new.service_version_id and status = 'published';
  elsif old.closed_at is null and new.closed_at is not null then
    update public.service_versions
    set status = case new.resolution
      when 'resumed' then 'published'::public.service_status
      else 'archived'::public.service_status
    end
    where id = new.service_version_id and status = 'paused';
  end if;

  perform set_config('legal_ai.pause_row', '', true);
  return null;
end;
$$;

create trigger service_pauses_apply
after insert or update on public.service_pauses
for each row execute function public.service_pauses_apply ();

-- A status flip with no row behind it is refused, from anywhere: this is an
-- invariant of the data, not a right, so a seed is held to it too.
create or replace function public.service_versions_pause_is_a_row ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if coalesce(current_setting('legal_ai.pause_row', true), '') = 'on' then
    return new;
  end if;

  v_open := exists (
    select 1 from public.service_pauses p
    where p.service_version_id = new.id and p.closed_at is null
  );

  if new.status = 'paused' and not v_open then
    raise exception
      'a pause is a row with a reason: insert into service_pauses (§5.7)';
  end if;

  if old.status = 'paused' and v_open then
    raise exception
      'service version % has an open pause; close it with a resolution (§5.7)', old.id;
  end if;

  return new;
end;
$$;

create trigger service_versions_pause_is_a_row
before update on public.service_versions
for each row execute function public.service_versions_pause_is_a_row ();

-- Publishing the fix closes the pause ----------------------------------------------
--
-- Restated from `20260918120000_practice_area_signatories.sql`, the last
-- migration to define it. The one addition: before the live predecessor is
-- archived, its open pause is closed as `new_version` naming this row. Closing
-- it is what archives it (the pause trigger above), so the archive statement
-- that follows finds it done and touches only predecessors that were not paused.

create or replace function public.service_versions_publish ()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
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
    perform set_config('legal_ai.fix_publishing', 'on', true);

    update public.service_pauses p
    set closed_at = now(),
        closed_by = auth.uid (),
        resolution = 'new_version',
        replaced_by = new.id
    where p.closed_at is null
      and p.service_version_id in (
        select sv.id from public.service_versions sv
        where sv.service_id = new.service_id
          and sv.id is distinct from new.id
          and sv.status = 'paused'
      );

    perform set_config('legal_ai.fix_publishing', '', true);

    update public.service_versions
    set status = 'archived'
    where service_id = new.service_id
      and id is distinct from new.id
      and status in ('published', 'paused');
  end if;

  if first_publication then
    -- Cover is not enough to publish against. Somebody has to be accountable
    -- for a service that is on sale, and that is the primary assignment.
    if not exists (
      select 1 from public.service_assignments a
      where a.service_id = new.service_id and a.is_primary
    ) then
      raise exception 'cannot publish a version of a service with no primary lawyer';
    end if;

    -- Nothing reaches a client that a lawyer has not signed (ADR-0027).
    if new.released_at is null then
      raise exception
        'service version % has not been released by a signatory of its practice area; it cannot be put on sale (ADR-0027)',
        new.id;
    end if;

    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(new.published_by, auth.uid ());
  end if;

  return new;
end;
$$;

-- Orders in flight are reviewed -----------------------------------------------------
--
-- A second guard on delivery beside `orders_lifecycle`, rather than a
-- restatement of it: the rule is one sentence and the function it would join
-- is two hundred lines, and a restatement is where a branch gets lost.

create or replace function public.version_known_wrong (target_version uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_pauses p
    where p.service_version_id = target_version
      and p.reason in ('defect', 'law_impact', 'generation')
      and (p.closed_at is null or p.resolution <> 'resumed')
  );
$$;

comment on function public.version_known_wrong (uuid) is
  '§5.7: the version carries a professional pause that was not a false alarm. Orders on it are delivered out of review or not at all.';

create or replace function public.orders_review_when_version_paused ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status <> 'delivered'
    and public.version_known_wrong (new.service_version_id) then
    if old.status is distinct from 'in_review' or new.reviewer_id is null then
      raise exception
        'service version % was paused for a professional reason; an order on it is delivered out of review, by a named reviewer, or not at all (§5.7)',
        new.service_version_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_review_when_version_paused
before update on public.orders
for each row execute function public.orders_review_when_version_paused ();

-- ADM-53 opens a row --------------------------------------------------------------------
--
-- Restated from `20260830130000_law_signals.sql`. Same condition, same set of
-- versions; the effect is a `law_impact` pause per version instead of a status
-- flip, and the status follows. A version already paused keeps its open row —
-- the partial unique index says one, and the first reason stands.

create or replace function public.law_signals_pause_affected_services ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state <> 'impact_confirmed' then
    return null;
  end if;

  if tg_op = 'UPDATE' and old.state = 'impact_confirmed' then
    return null;
  end if;

  insert into public.service_pauses (service_version_id, reason, signal_id, note)
  select sv.id, 'law_impact', new.id, new.resolution_note
  from public.service_versions sv
  where sv.status = 'published'
    and exists (
      select 1 from public.service_law_refs r
      where r.service_id = sv.service_id and r.norm_id = new.norm_id
    )
    and not exists (
      select 1 from public.service_pauses p
      where p.service_version_id = sv.id and p.closed_at is null
    );

  return null;
end;
$$;

comment on function public.law_signals_pause_affected_services () is
  'Q5: a confirmed impact opens a law_impact pause on every published version resting on the norm. Never un-pauses — reinstatement is publishing the fix.';

-- Audit -----------------------------------------------------------------------------------
--
-- Restated from `20260918120000_practice_area_signatories.sql`, the most recent
-- restatement, plus one mapping. The entity is the pause; the service is
-- resolved through the version, as `document_blocks` does.

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
    when 'document_blocks' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := public.version_service ((v_row ->> 'service_version_id')::uuid);
    when 'law_signals' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := null;
    when 'user_roles' then
      -- The entity is the person, not the row: "what happened to this member"
      -- is the cut the team screen will ask for.
      v_entity := (v_row ->> 'user_id')::uuid;
      v_service := null;
    when 'practice_area_signatories' then
      v_entity := (v_row ->> 'lawyer_id')::uuid;
      v_service := null;
    when 'service_pauses' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := public.version_service ((v_row ->> 'service_version_id')::uuid);
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

create trigger service_pauses_audit
after insert or update or delete on public.service_pauses
for each row execute function public.audit_change ();

-- Access ------------------------------------------------------------------------------------
--
-- Both staff roles read and write; the guard above is where the reason-based
-- rules live (ADR-0019's shape: RLS says who reaches the table, a security
-- definer trigger says what a write may do). Nobody deletes: a pause is
-- history the moment it opens.

alter table public.service_pauses enable row level security;

grant select, insert, update on table public.service_pauses to authenticated;

create policy "service_pauses_select_staff" on public.service_pauses
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "service_pauses_write_staff" on public.service_pauses
  for insert to authenticated
  with check (public.jwt_role () in ('admin', 'lawyer'));

create policy "service_pauses_update_staff" on public.service_pauses
  for update to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'))
  with check (public.jwt_role () in ('admin', 'lawyer'));

-- Several lawyers may be attached to one service, with exactly one accountable.
--
-- `services.assigned_lawyer_id` could hold one person, which breaks the case it
-- was written for: the assigned lawyer goes on holiday and something needs
-- checking today. Cover has to be a real relationship, not a note somewhere.
--
-- One accountable owner is kept, deliberately. The lawyer's cabinet (spec
-- §4.10) shows what is owed *today*, and §9.16 commits to triaging a signal
-- within one business day — both need an addressee. A flat set of equals reads
-- well until an SLA is missed, at which point "everyone was responsible" and
-- "nobody was" are the same sentence. So: one `is_primary`, enforced by a
-- partial unique index, plus any number of cover assignments that carry the
-- same rights and none of the obligation.
--
-- This answers Q18 in docs/specs/admin-console.md §14.
--
-- The old column is dropped rather than kept in sync. Two places recording who
-- is assigned is the drift this repo keeps having to repair.

create table public.service_assignments (
  service_id uuid not null references public.services (id) on delete cascade,
  lawyer_id uuid not null references public.profiles (id) on delete cascade,
  is_primary boolean not null default false,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  primary key (service_id, lawyer_id)
);

comment on table public.service_assignments is
  'Who may act on a service. Exactly one is_primary per service carries the obligations; the rest are cover.';

create unique index service_assignments_one_primary
  on public.service_assignments (service_id)
  where is_primary;

create index service_assignments_by_lawyer
  on public.service_assignments (lawyer_id);

insert into public.service_assignments (service_id, lawyer_id, is_primary)
select id, assigned_lawyer_id, true
from public.services
where assigned_lawyer_id is not null;

-- Membership helpers ---------------------------------------------------------
--
-- SECURITY DEFINER is not optional here. These are called from policies *on*
-- `service_assignments`, and a plain function would re-enter that table's RLS
-- to answer the question RLS is asking — which Postgres reports as infinite
-- recursion at query time, not at migration time.

create or replace function public.is_assigned_to (target_service uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_assignments a
    where a.service_id = target_service and a.lawyer_id = auth.uid ()
  );
$$;

create or replace function public.is_primary_for (target_service uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_assignments a
    where a.service_id = target_service
      and a.lawyer_id = auth.uid ()
      and a.is_primary
  );
$$;

-- Policies that used to key on the dropped column --------------------------

drop policy "services_update_assigned_lawyer" on public.services;

create policy "services_update_assigned_lawyer" on public.services
  for update to authenticated
  using (public.jwt_role () = 'lawyer' and public.is_assigned_to (id))
  with check (public.jwt_role () = 'lawyer' and public.is_assigned_to (id));

drop policy "service_versions_write_assigned_lawyer" on public.service_versions;

create policy "service_versions_write_assigned_lawyer" on public.service_versions
  for all to authenticated
  using (
    public.jwt_role () = 'lawyer'
    and published_at is null
    and public.is_assigned_to (service_id)
  )
  with check (
    public.jwt_role () = 'lawyer'
    and published_at is null
    and status in ('draft', 'in_review')
    and public.is_assigned_to (service_id)
  );

drop policy "questionnaire_fields_write_assigned_lawyer" on public.questionnaire_fields;

create policy "questionnaire_fields_write_assigned_lawyer" on public.questionnaire_fields
  for all to authenticated
  using (public.jwt_role () = 'lawyer' and public.is_assigned_to (service_id))
  with check (public.jwt_role () = 'lawyer' and public.is_assigned_to (service_id));

drop policy "audit_events_select_assigned_lawyer" on public.audit_events;

create policy "audit_events_select_assigned_lawyer" on public.audit_events
  for select to authenticated
  using (public.jwt_role () = 'lawyer' and public.is_assigned_to (service_id));

-- Triggers that used to read the dropped column -----------------------------

create or replace function public.services_guard_catalogue_columns ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Guard on the lawyer role explicitly rather than on "not admin": outside a
  -- request there is no JWT at all, and a migration or a seed running as
  -- postgres must not be caught by this.
  if public.jwt_role () = 'lawyer' and new.slug is distinct from old.slug then
    raise exception 'the slug is a catalogue decision; ask an admin to change it';
  end if;

  return new;
end;
$$;

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

    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(new.published_by, auth.uid ());
  end if;

  return new;
end;
$$;

alter table public.services drop column assigned_lawyer_id;

-- Audit ---------------------------------------------------------------------
--
-- audit_change raises for a table it has no entity mapping for, which is how
-- adding one forces this decision instead of quietly logging a null service.

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
      -- Composite key: the service is the entity, and the lawyer is in the
      -- payload. Who covers for whom is exactly the kind of thing somebody
      -- will need to reconstruct after an SLA breach.
      v_entity := (v_row ->> 'service_id')::uuid;
      v_service := v_entity;
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

create trigger service_assignments_audit
after insert or update or delete on public.service_assignments
for each row execute function public.audit_change ();

-- Access to the assignment table itself --------------------------------------

alter table public.service_assignments enable row level security;

grant select, insert, update, delete on table public.service_assignments to authenticated;

create policy "service_assignments_select_staff" on public.service_assignments
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "service_assignments_write_admin" on public.service_assignments
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

-- The case this table exists for: the accountable lawyer arranges their own
-- cover. They may add and remove cover on their own service, and they may not
-- hand over accountability — `is_primary` stays an admin decision, or a lawyer
-- could quietly assign their obligations to somebody who never agreed.
create policy "service_assignments_cover_by_primary" on public.service_assignments
  for all to authenticated
  using (
    public.jwt_role () = 'lawyer'
    and not is_primary
    and public.is_primary_for (service_id)
  )
  with check (
    public.jwt_role () = 'lawyer'
    and not is_primary
    and public.is_primary_for (service_id)
  );

-- Staff may read staff names -------------------------------------------------
--
-- Until now a lawyer could read only their own profile, so the catalogue's
-- "assigned lawyer" column showed "name unavailable" for every service that was
-- not theirs. `profiles` is the staff directory — clients do not live here
-- (ADR-0014) — so colleagues reading colleagues' names is ordinary.
--
-- Restricted to rows that have a role: a pending registration is a stranger who
-- filled in a form, not a colleague, and their email is not staff business.

create policy "profiles_select_staff" on public.profiles
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer') and role is not null);

-- Setting the primary, atomically --------------------------------------------
--
-- Two statements from a browser client are two chances to be interrupted
-- halfway, leaving a service with no accountable lawyer or with the old primary
-- still holding the slot. The partial unique index would reject the second
-- write anyway, so the client would see a confusing constraint error rather
-- than a clean one.

create or replace function public.set_primary_lawyer (target_service uuid, new_lawyer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'only admins can change who is accountable for a service';
  end if;

  if not exists (select 1 from public.services s where s.id = target_service) then
    raise exception 'no such service';
  end if;

  update public.service_assignments
  set is_primary = false
  where service_id = target_service and is_primary;

  if new_lawyer is not null then
    insert into public.service_assignments (service_id, lawyer_id, is_primary, assigned_by)
    values (target_service, new_lawyer, true, auth.uid ())
    on conflict (service_id, lawyer_id)
    do update set is_primary = true, assigned_by = auth.uid ();
  end if;
end;
$$;

revoke all on function public.set_primary_lawyer (uuid, uuid) from public, anon;
grant execute on function public.set_primary_lawyer (uuid, uuid) to authenticated;

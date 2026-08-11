-- The append-only action log (ADR-0010).
--
-- This is late. ADR-0010 says the log "must exist from the first migration that
-- creates a domain table" and that it "cannot be backfilled: what is not
-- recorded at the time is gone". Four domain tables shipped before it. The cost
-- so far is only the history of a development database, and it stops growing
-- here — but the ADR was right about the shape of the mistake, and the reason
-- it is worth naming is that nothing failed. Every gate was green the whole
-- time, because a missing log is not an error, it is silence.
--
-- Three properties, each of which is load-bearing rather than tidy:
--
--   Written server-side. The trigger is SECURITY DEFINER and `authenticated`
--   holds no INSERT grant, so no browser path can write or forge an event. An
--   audit record the frontend is trusted to produce cannot be relied on, and a
--   log that cannot be relied on is worse than none — it still gets believed.
--
--   Append-only in fact, not by convention. UPDATE, DELETE and TRUNCATE are
--   refused by triggers, not only by absent grants, because `service_role`
--   bypasses RLS and holds TRUNCATE on public tables by platform default.
--
--   No personal data in payloads (§6.4). Today's four tables are catalogue and
--   dictionary data with no client in them, so the whole row is recorded. A
--   table that carries client data passes its personal-data columns as trigger
--   arguments: the column name still appears in `changed_columns`, so the log
--   says *that* it changed without saying what to. Erasure then works by
--   destroying the pseudonym mapping, exactly as ADR-0010 describes.
--
-- The access log is deliberately not here. §6.2 keeps reads separate from
-- writes — different volume, different retention (§7.2: one year against
-- seven) — and it has no writers until client data and the gateway exist. It
-- lands with them.

create type public.audit_action as enum ('insert', 'update', 'delete');

create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),

  -- Deliberately NOT foreign keys. An audit row is evidence, and evidence that
  -- a cascade can reshape is not evidence: deleting a lawyer must not blank the
  -- record of what they did, and deleting a service must not take its history
  -- with it. Orphaned ids are the correct outcome here.
  actor_id uuid,
  actor_role text,
  service_id uuid,

  action public.audit_action not null,
  entity_table text not null,
  entity_id uuid not null,

  -- Recorded before redaction, so a column can be known to have changed
  -- without its value being kept.
  changed_columns text[],
  before jsonb,
  after jsonb
);

comment on table public.audit_events is
  'Append-only action log (ADR-0010). Current status is a projection of this, never a column it describes.';

comment on column public.audit_events.actor_role is
  'The role held at the time, not the role held now — §6.2 asks what a person did under the rights they had.';

-- The three cuts of §6.2: by entity, by service (the history screen), by actor.
create index audit_events_entity on public.audit_events (entity_table, entity_id, occurred_at desc);
create index audit_events_service on public.audit_events (service_id, occurred_at desc);
create index audit_events_actor on public.audit_events (actor_id, occurred_at desc);

-- Append-only ---------------------------------------------------------------

create or replace function public.audit_events_append_only ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only (ADR-0010): % is not permitted', tg_op;
end;
$$;

create trigger audit_events_no_update
before update on public.audit_events
for each statement execute function public.audit_events_append_only ();

create trigger audit_events_no_delete
before delete on public.audit_events
for each statement execute function public.audit_events_append_only ();

-- TRUNCATE is not caught by the two above, is not constrained by RLS, and is
-- held by service_role through the platform's default privileges.
create trigger audit_events_no_truncate
before truncate on public.audit_events
for each statement execute function public.audit_events_append_only ();

-- The writer ----------------------------------------------------------------

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

    -- An UPDATE that changed nothing is not an event. Without this every
    -- idempotent write would add a row saying so.
    if v_changed is null then
      return null;
    end if;
  end if;

  v_row := coalesce(v_after, v_before);

  -- Explicit per table rather than clever. A new table reaching this function
  -- without a mapping raises instead of quietly logging a null service, which
  -- is how the per-service history screen would develop holes nobody notices.
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
    else
      raise exception 'audit_change has no entity mapping for table %', tg_table_name;
  end case;

  -- §6.4: names survive, values do not. Trigger arguments name the columns a
  -- table considers personal data.
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

comment on function public.audit_change () is
  'AFTER trigger for domain tables. Arguments name personal-data columns to redact from the payload (§6.4).';

create trigger services_audit
after insert or update or delete on public.services
for each row execute function public.audit_change ();

create trigger service_versions_audit
after insert or update or delete on public.service_versions
for each row execute function public.audit_change ();

create trigger service_version_prices_audit
after insert or update or delete on public.service_version_prices
for each row execute function public.audit_change ();

create trigger questionnaire_fields_audit
after insert or update or delete on public.questionnaire_fields
for each row execute function public.audit_change ();

-- Reading -------------------------------------------------------------------

alter table public.audit_events enable row level security;

-- SELECT only. No INSERT grant anywhere: the definer function above is the
-- only writer, which is what makes "written server-side" true rather than
-- intended.
grant select on table public.audit_events to authenticated;

create policy "audit_events_select_admin" on public.audit_events
  for select to authenticated
  using (public.jwt_role () = 'admin');

-- §4.8 is a per-service history screen, so a lawyer sees the history of the
-- services they are accountable for and nothing else.
create policy "audit_events_select_assigned_lawyer" on public.audit_events
  for select to authenticated
  using (
    public.jwt_role () = 'lawyer'
    and exists (
      select 1 from public.services s
      where s.id = service_id and s.assigned_lawyer_id = auth.uid ()
    )
  );

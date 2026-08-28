-- Document blocks: the authored structure of a template version (ADM-1's
-- remainder, spec §4.5, §5.1, ADR-0009, ADR-0013).
--
-- One row per block a lawyer authors on a service version: its heading, its
-- text, the branching condition that selects it, and whether extraction wants a
-- human to read it. This is the *authoring* side. The generation trace
-- (`packages/core-client/schema/trace.schema.json`) is the *generation* side,
-- and the two are deliberately mirrors — a `TraceBlock` carries `id`, `title`,
-- `selected_by` and `needs_attention`, and each of them resolves to a column
-- here. That mutual constraint is why this table waited for the trace schema to
-- freeze rather than being written alongside the catalogue.
--
-- Three rules are schema here rather than a paragraph somebody has to remember:
--
--   1. **A block key is an identifier, not a heading.** The trace promises
--      block ids are stable across regenerations, so a re-run updates the trace
--      instead of scrambling it. That promise is only worth something if the
--      key cannot be renamed, so it is immutable and the title carries the
--      renaming urge — exactly the argument `questionnaire_fields.key` already
--      makes for field keys.
--   2. **A published version's blocks are frozen** (§5.4, ADR-0009). Editing a
--      published service must not exist as an operation, and blocks are where
--      most of a version's content actually lives — a freeze that guarded the
--      version row and left its blocks writable would be a freeze in name. The
--      guard is a trigger, not a policy, for ADR-0019's reason: the writer that
--      matters most here is whatever holds `service_role`, which RLS does not
--      apply to at all.
--   3. **There is no editor for the bot's script** (ADR-0013). The order the
--      chat bot asks its questions is a projection of these conditions over the
--      field dictionary, computed rather than authored. `condition_expression`
--      is therefore the single source of the branching, and a second table
--      describing the same flow would be the "one thing said twice" defect this
--      project has hit before.
--
-- **What this migration deliberately does not carry.** A block's links to
-- questionnaire fields (ADM-20) and to the service's law dependencies (ADM-22)
-- are the trace's `questionnaire_fields` and `law_ref_ids`, and they are two
-- link tables with their own cross-service guards, policies and audit mappings.
-- They follow in their own migration rather than doubling this one. Until they
-- land, `condition_expression` is prose a person reads and the trace's
-- `field_keys` has no authored counterpart — which is part of why nothing
-- generates from this table yet.

create table public.document_blocks (
  id uuid primary key default gen_random_uuid (),

  -- Blocks belong to a version, not to a service: they are the content the
  -- freeze protects. The field dictionary is per service by contrast, because
  -- a key is the vocabulary a service speaks across all of its versions.
  service_version_id uuid not null
    references public.service_versions (id) on delete cascade,

  -- `TraceBlock.id`. Authored once, never renamed.
  key text not null,

  title text not null,

  -- The block's text as the lawyer authored it. Empty is not a block.
  body text not null,

  -- Document order. Deliberately not unique: reordering a list through a unique
  -- column means a dance of temporary values for no gain.
  position integer not null default 0,

  -- `TraceBlock.selected_by`. Null is an unconditional block, which is what the
  -- trace's null means too.
  condition_expression text,

  -- `TraceBlock.needs_attention`: extraction is not confident and a human
  -- should read this before the version is published.
  needs_attention boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (service_version_id, key),

  constraint document_blocks_key_shape check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint document_blocks_title_present check (length(btrim(title)) > 0),
  constraint document_blocks_body_present check (length(btrim(body)) > 0),

  -- A condition that is present but blank is a block whose selection nobody can
  -- explain. Absent means unconditional; blank means a mistake.
  constraint document_blocks_condition_present check (
    condition_expression is null or length(btrim(condition_expression)) > 0
  )
);

comment on table public.document_blocks is
  'The authored blocks of a template version (§4.5). Mirrors TraceBlock in the core contract; frozen once the version is published (ADR-0009).';

comment on column public.document_blocks.key is
  'Stable block identity, the authored counterpart of TraceBlock.id. Immutable, so a regeneration updates the trace rather than scrambling it.';

create index document_blocks_version_position
  on public.document_blocks (service_version_id, position);

-- The tree view (§4.5) leads with what needs reading, so the flag is worth a
-- partial index rather than a scan over every block of a version.
create index document_blocks_needs_attention
  on public.document_blocks (service_version_id)
  where needs_attention;

create trigger document_blocks_touch_updated_at
before update on public.document_blocks
for each row execute function public.touch_updated_at ();

-- Freeze ---------------------------------------------------------------------
--
-- `security definer` on the lookup is load-bearing rather than decorative.
-- Without it the read runs as the caller and returns no row when the version is
-- invisible to them — and a freeze check that reads null would wave the write
-- through. That failure is silent, which is the class this repository keeps
-- paying for; raising for a version that does not exist is how it stays loud.

create or replace function public.version_is_frozen (target_version uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_published timestamptz;
  v_found boolean := false;
begin
  select sv.published_at, true into v_published, v_found
  from public.service_versions sv where sv.id = target_version;

  if not coalesce(v_found, false) then
    raise exception 'service version % does not exist', target_version;
  end if;

  return v_published is not null;
end;
$$;

comment on function public.version_is_frozen (uuid) is
  'Whether a version has been published and its content is therefore frozen (ADR-0009). Raises for a version that does not exist, so a missing row cannot read as unfrozen.';

create or replace function public.document_blocks_freeze ()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_version uuid;
begin
  v_version := coalesce(new.service_version_id, old.service_version_id);

  if public.version_is_frozen (v_version) then
    raise exception
      'service version % is published; its blocks are frozen (ADR-0009)',
      v_version;
  end if;

  if tg_op = 'UPDATE' then
    -- Moving a block between versions would let an edit to a draft rewrite what
    -- a published version is made of: the freeze defeated by one column.
    if new.service_version_id is distinct from old.service_version_id then
      raise exception 'a block cannot move between versions';
    end if;
    if new.key is distinct from old.key then
      raise exception 'block key % is immutable; change the title instead', old.key;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger document_blocks_freeze
before insert or update or delete on public.document_blocks
for each row execute function public.document_blocks_freeze ();

-- Audit ----------------------------------------------------------------------
--
-- No event table of its own (ADR-0010): `audit_events` is the log, and this
-- table joins it by gaining an entity mapping below. The mapping raises for a
-- table it does not know, which is what stops a new domain table from quietly
-- logging a null service.
--
-- No redaction arguments: a template block is the firm's own text, not a
-- client's (§4.5, "who may look" — both staff roles read templates freely).

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

create trigger document_blocks_audit
after insert or update or delete on public.document_blocks
for each row execute function public.audit_change ();

-- Reading and writing --------------------------------------------------------
--
-- A template carries no client data, so both staff roles read it freely (§4.5).
-- Writing is the assigned lawyer's — §4.5's user stories are all theirs, and
-- correcting what extraction got wrong is a legal judgement about the firm's
-- own precedent. Admins write too, as everywhere in the catalogue.
--
-- The predicate goes through the version to its service, because assignment is
-- recorded per service (`service_assignments`) and a block hangs off a version.

alter table public.document_blocks enable row level security;

grant select, insert, update, delete on table public.document_blocks to authenticated;

create policy "document_blocks_select_staff" on public.document_blocks
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "document_blocks_write_admin" on public.document_blocks
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

create policy "document_blocks_write_assigned_lawyer" on public.document_blocks
  for all to authenticated
  using (
    public.jwt_role () = 'lawyer'
    and public.is_assigned_to (public.version_service (service_version_id))
  )
  with check (
    public.jwt_role () = 'lawyer'
    and public.is_assigned_to (public.version_service (service_version_id))
  );

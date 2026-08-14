-- Client identity, split from the pseudonym that stands in for it (ADR-0014,
-- ADR-0010, spec §7.1).
--
-- A client is whoever orders a document. They are deliberately not a row in
-- `profiles`: that table is staff, 1:1 with `auth.users`, and it already carries
-- an admin-wide read policy. Role governs platform capability; assignment
-- governs case data. Putting the two on one table would make "reads every
-- client's case" a consequence of being a lawyer, which nobody would choose on
-- purpose.
--
-- Two tables rather than one, and this is the whole design:
--
--   `clients` is the anchor and holds no personal data at all. An id, a
--   pseudonym to show a human, and whether the mapping behind it has been
--   destroyed. Everything client-bearing that lands later — orders, answers,
--   issued documents — keys on `clients.id` and can be read, joined and counted
--   without touching a person.
--
--   `client_identities` is the mapping, and it is the *only* place a client's
--   name exists. ADR-0010 requires that mapping to live in exactly one place so
--   that erasure can destroy it and leave the audit log intact but no longer
--   identifying. One table makes that a `delete`; personal columns spread across
--   a wide `clients` table would make it a list of columns somebody has to keep
--   correct, which is the kind of list that goes stale silently.
--
-- Neutral to Q21 (§14: is a client account a person or a tenant with members?).
-- Everything keys on `client_id`, so the tenant answer adds a members table
-- (ADM-68) rather than a column to every table and a term to every policy. What
-- is 1:1 today is the identity, and that is the one place the question lands.
--
-- Nobody can read `client_identities` yet, on purpose — see the grants at the
-- bottom.

-- The anchor ------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid (),

  -- What a depersonalised screen shows (§7.3: an admin sees a case
  -- depersonalised by default). A uuid is not a label a person can hold in
  -- their head or say out loud on a call, and the alternative — a counter —
  -- would publish how many clients the firm has and in what order they arrived.
  pseudonym text not null unique default 'client-' || substr(md5(gen_random_uuid ()::text), 1, 8),

  created_at timestamptz not null default now(),

  -- Erasure is a state of the anchor, not the absence of a row. The row has to
  -- survive: orders and issued documents point at it, and the audit log refers
  -- to it. What stops existing is the mapping.
  erased_at timestamptz,
  erasure_basis text,

  -- `erasure_basis is not null` is not redundant with the `in` list, and the
  -- verification script found that out rather than a reviewer: an `in` against
  -- a null yields null, `false or null` is null, and a CHECK accepts null. The
  -- constraint therefore admitted exactly the row it exists to refuse — a
  -- client erased on no recorded basis.
  constraint clients_erasure_is_complete check (
    (erased_at is null and erasure_basis is null)
    or (
      erased_at is not null
      and erasure_basis is not null
      and erasure_basis in ('request', 'retention')
    )
  )
);

comment on table public.clients is
  'One row per client account, carrying no personal data. The mapping to a person is client_identities (ADR-0010).';

comment on column public.clients.pseudonym is
  'Stable, immutable, shown wherever a client is named on a depersonalised screen. Survives erasure.';

comment on column public.clients.erasure_basis is
  'Why the mapping was destroyed: at the client''s request, or because retention ran out (§7.2).';

-- A pseudonym that can be rewritten is not stable, and every audit event and
-- issued document that already carries it would start referring to somebody
-- else's label.
create or replace function public.clients_guard_pseudonym ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pseudonym is distinct from old.pseudonym then
    raise exception 'a client pseudonym is permanent; the log and the documents already refer to it';
  end if;
  return new;
end;
$$;

create trigger clients_pseudonym_immutable
before update on public.clients
for each row execute function public.clients_guard_pseudonym ();

-- The mapping -----------------------------------------------------------------

create table public.client_identities (
  -- The primary key is the client. One identity per account today; if Q21
  -- answers "tenant", membership arrives as its own table (ADM-68) and this
  -- constraint is the single place that has to change.
  client_id uuid primary key references public.clients (id) on delete cascade,

  full_name text not null,
  email text,
  phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.client_identities is
  'The pseudonym-to-person mapping ADR-0010 requires to live in exactly one place. Erasure deletes rows here.';

create trigger client_identities_touch_updated_at
before update on public.client_identities
for each row execute function public.touch_updated_at ();

-- Erasure ---------------------------------------------------------------------
--
-- Destroying the mapping is one of the two mechanisms §7.2 names. The other is
-- the hard delete of chat transcripts (ADR-0013), and there is no transcript
-- table yet — so this function does half of erasure today and has to gain the
-- second statement in the migration that creates transcripts. Stated here
-- rather than in a backlog row because this is where somebody will be standing
-- when it matters.
--
-- SECURITY DEFINER because `client_identities` is granted to nobody: this
-- function and the migrations are the only things that touch it.

create or replace function public.erase_client (target_client uuid, basis text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'only admins can erase a client';
  end if;

  if basis not in ('request', 'retention') then
    raise exception 'invalid erasure basis: %', basis;
  end if;

  if not exists (select 1 from public.clients c where c.id = target_client) then
    raise exception 'no such client';
  end if;

  delete from public.client_identities where client_id = target_client;

  -- coalesce, not assignment: erasure happened once, and a second call must not
  -- move the date it happened on. It also makes the second call write nothing,
  -- so the audit log does not collect repeat events for one erasure.
  update public.clients
  set erased_at = coalesce(erased_at, now()),
    erasure_basis = coalesce(erasure_basis, basis)
  where id = target_client;
end;
$$;

comment on function public.erase_client (uuid, text) is
  'Destroys the pseudonym mapping (§7.1). Transcript deletion joins this function when transcripts exist (ADR-0013).';

revoke all on function public.erase_client (uuid, text) from public, anon;
grant execute on function public.erase_client (uuid, text) to authenticated;

-- Audit -----------------------------------------------------------------------
--
-- `audit_change` raises for a table it has no mapping for, which is what forces
-- this block to exist rather than letting a client-bearing table log a null
-- service by accident. Here the null is the correct answer and so it is written
-- out: a client belongs to no service. The consequence is that these events are
-- visible to admins only, because the lawyer policy on `audit_events` keys on
-- an assignment to a service — which is right, and stops being the whole story
-- when orders arrive and carry a service of their own.

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
      -- The client is the entity. There is no id of its own to record, and one
      -- would be a second name for the same thing.
      v_entity := (v_row ->> 'client_id')::uuid;
      v_service := null;
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

-- No redaction arguments: `clients` holds nothing to redact, and that is the
-- point of the split.
create trigger clients_audit
after insert or update or delete on public.clients
for each row execute function public.audit_change ();

-- §6.4, and the reason the redaction argument list exists. `changed_columns`
-- still says a name or an email changed; the payload does not say what to. So
-- the log can answer "was this record touched, by whom, when" for seven years
-- (§7.2) while holding nothing that erasure would have to reach into — which is
-- exactly what makes the log survive erasure instead of contradicting it.
create trigger client_identities_audit
after insert or update or delete on public.client_identities
for each row execute function public.audit_change ('full_name', 'email', 'phone');

-- Access ----------------------------------------------------------------------

alter table public.clients enable row level security;
alter table public.client_identities enable row level security;

-- The anchor is pseudonymous, so staff reading it is ordinary — it is what a
-- depersonalised screen renders. No write policy: nothing in the console
-- creates a client. They arrive with an order, through the gateway, which gets
-- its grants written out when it lands (ADM-5).
grant select on table public.clients to authenticated;

create policy "clients_select_staff" on public.clients
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

-- `client_identities` gets no grant and no policy, and this is a decision
-- rather than an omission.
--
-- ADR-0014 names exactly two ways to reach a client's name, and neither can be
-- built honestly today. The assigned lawyer's path runs through the matter they
-- are assigned to, and matters are `orders` — ADM-63, which Q21 blocks.
-- Break-glass is a row with a reason and an expiry, and the ADR requires it to
-- be written to the access log and notified to the client; the access log
-- arrives with the gateway (ADM-5, §6.2). Shipping the grant table without the
-- log would produce the failure the ADR calls out by name: an access grant
-- nobody notices looks like control while providing none.
--
-- So the safe default in supabase/CLAUDE.md applies — RLS on, no policies —
-- and it is doubled by withholding the grant, because a missing grant fails
-- loudly with a permission error while a missing policy fails silently with an
-- empty result. `erase_client` is SECURITY DEFINER and reaches the table
-- regardless, which is the one operation that has to work before anybody can
-- read anything.

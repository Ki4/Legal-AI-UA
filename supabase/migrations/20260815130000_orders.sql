-- Orders: the matter a client's document is issued under (ADM-63, spec §5.3,
-- §5.4, §6.1, ADR-0005, ADR-0009, ADR-0014).
--
-- One row per thing a client asked for. It is the first table that is *about* a
-- client rather than about the firm — and, like `clients` and `entitlements`
-- before it, it holds no personal data: `client_id` is the pseudonymous anchor
-- of ADM-62. The names live in `client_identities`, the answers will live in
-- ADM-64, the document in ADM-65. That is what lets a review queue, a statistic
-- and an audit trail be built over orders without any of them touching a
-- person.
--
-- Four rules the backlog fixed before this table could exist, and each one is a
-- line of schema here rather than a paragraph somebody has to remember:
--
--   1. **The order pins a version, not a service** (§5.4, ADR-0009). The
--      foreign key points at `service_versions` and can never be moved. A
--      document issued in March stays explainable in October, after the service
--      has been republished twice.
--   2. **An order has no event table of its own** (ADR-0010). `audit_events` is
--      the log; this table joins it by gaining an entity mapping in
--      `audit_change`, which raises for a table it does not know. ADM-66's
--      timeline is a read of that log, not a second history.
--   3. **Staleness is a projection, not a column.** Nothing here records that
--      the law under a document has moved. That is derived from the norm
--      register through the pinned version (§9.3, ADM-24); a boolean here would
--      be a copy of the truth that drifts from it.
--   4. **Assignment governs case data** (ADR-0014). `reviewer_id` is the
--      per-matter anchor the narrower policies of ADM-64 and ADM-65 will key
--      on. It exists now because retrofitting it into a table that already has
--      rows is the expensive version of the same column.
--
-- **Why `status` is a column when §6.1 says status is a projection of the log.**
-- The two are not in conflict here, and the direction matters. §6.1 refuses a
-- status column that is *maintained alongside* a log — one written by the
-- application, the other by hope. This column is the thing that is written, and
-- the log is derived from it by the trigger below: every move lands in
-- `audit_events` with its before and after, so the timeline ADM-66 renders is
-- reconstructed from the log exactly as §6.1 requires. What §6.1 rules out is a
-- second, mutable answer, and there is one answer here.
--
-- **Nothing writes to this table yet, on purpose.** Orders arrive through the
-- gateway (ADM-5), like the clients that carry them; the console gains its
-- writes with the order card and the review queue (ADM-66, ADM-67). So the
-- lifecycle rules are triggers rather than policies — the gateway will hold
-- `service_role`, which bypasses RLS entirely, and a rule that only RLS
-- enforces is a rule the one writer would not be subject to. This is the same
-- argument ADR-0009's freeze is built on.

create type public.order_status as enum (
  -- The conversation is open and answers are being collected (ADR-0013).
  'intake',
  -- The client is finished. What they said is what generation will read.
  'submitted',
  'generating',
  -- ADR-0005: because the version requires a lawyer, or because the client
  -- asked for one on a version that did not.
  'in_review',
  'delivered',
  -- Ended by a person, and ended by silence. §7.2 gives an abandoned intake a
  -- shorter transcript clock than a delivered order, so they cannot be one
  -- state with a comment.
  'cancelled',
  'abandoned'
);

-- Which service a version belongs to. One place answers it, because the policy,
-- the pinning guard and the delivery guard all need it and a subquery written
-- three times is a rule maintained three times.
--
-- SECURITY DEFINER so the guards resolve it regardless of who is writing — the
-- gateway, a migration, an admin. What it returns is catalogue: which service a
-- version is a version of, which every member of staff may already read.
create or replace function public.version_service (target_version uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sv.service_id from public.service_versions sv where sv.id = target_version;
$$;

comment on function public.version_service (uuid) is
  'The service a pinned version belongs to. One definition, because the order policy and both order guards need it.';

revoke all on function public.version_service (uuid) from public, anon;
grant execute on function public.version_service (uuid) to authenticated;

-- The table -------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid (),

  -- `restrict`, like the entitlement. Erasure destroys the mapping and leaves
  -- the anchor standing (§7.1) precisely so that an issued document keeps
  -- resolving to the account it was issued to; a cascade here would delete the
  -- matter the passport is evidence of.
  client_id uuid not null references public.clients (id) on delete restrict,

  -- Rule 1. Never `services`. `on delete restrict` is the other half of it: a
  -- version somebody ordered from is not deletable, which is already true of a
  -- published version (ADR-0009) and is now true for a second, independent
  -- reason.
  service_version_id uuid not null references public.service_versions (id) on delete restrict,

  -- Which purchase paid for this. Null through intake, because a conversation
  -- starts before a payment does; required at delivery, checked against the
  -- entitlement itself rather than against the client — see the delivery guard.
  entitlement_id uuid references public.entitlements (id) on delete restrict,

  status public.order_status not null default 'intake',

  -- Rule 4. Null until somebody picks the matter up. Not a column on
  -- `service_assignments`: cover is who *may* act on a service, this is who is
  -- answering for one client's document.
  reviewer_id uuid references public.profiles (id) on delete set null,

  -- ADR-0005: `auto` is restricted to documents with no legal consequences for
  -- the person ordering them, and even those surface a request for human
  -- review — an Art. 22 requirement and a product commitment. The version's
  -- `review_mode` cannot carry this, because it is frozen and this is one
  -- client's choice about one document.
  human_review_requested boolean not null default false,

  placed_at timestamptz not null default now(),
  submitted_at timestamptz,
  delivered_at timestamptz,

  -- Cancelled or abandoned. One column, because §7.2's clock starts on the
  -- order ending either way and two would need a rule about which to read.
  closed_at timestamptz,

  updated_at timestamptz not null default now()
);

comment on table public.orders is
  'One client matter. Pins a frozen version (ADR-0009); carries no personal data — client_id is the ADM-62 pseudonym.';

comment on column public.orders.service_version_id is
  'The version this document is issued from, fixed at ordering. Never a service, never re-pointed (§5.4).';

comment on column public.orders.human_review_requested is
  'The client asked for a human on a version that did not require one (Art. 22, ADR-0005). Never turns review off.';

comment on column public.orders.closed_at is
  'When the order ended without delivery. §7.2 gives an abandoned intake 30 days of transcript, a delivered order 90.';

create index orders_by_client on public.orders (client_id);
create index orders_by_version on public.orders (service_version_id);

-- The review queue reads this one (ADM-67): whose desk is it on, oldest first.
create index orders_by_reviewer on public.orders (reviewer_id, placed_at)
  where reviewer_id is not null;

create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at ();

-- What cannot move ------------------------------------------------------------

create or replace function public.orders_guard_pins ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.client_id is distinct from old.client_id then
    raise exception 'an order belongs to the client who placed it';
  end if;

  -- §5.4 as an operation that does not exist. Re-pointing an order at another
  -- version would silently rewrite what the document was issued from, which is
  -- the one thing the passport is for. §8.4's re-issue is a new document
  -- version against a new order, not this row edited.
  if new.service_version_id is distinct from old.service_version_id then
    raise exception 'an order pins the version it was placed against (§5.4, ADR-0009)';
  end if;

  -- A delivered order is evidence. Its passport (ADM-65) will refer to the
  -- reviewer and the entitlement recorded here, so those stop being editable at
  -- the moment the client receives the file.
  if old.status = 'delivered' then
    if new.reviewer_id is distinct from old.reviewer_id
      or new.entitlement_id is distinct from old.entitlement_id
      or new.human_review_requested is distinct from old.human_review_requested then
      raise exception 'order % is delivered; what it was issued under is settled', old.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_guard_pins
before update on public.orders
for each row execute function public.orders_guard_pins ();

-- The lifecycle ---------------------------------------------------------------
--
-- Named `orders_lifecycle` rather than anything sorting before `guard`, so the
-- pins are checked first: Postgres fires BEFORE triggers in name order, and a
-- re-pointed version should be refused as a re-pointed version and not as a
-- delivery of the wrong thing.
--
-- SECURITY DEFINER, and not as a convenience. This function reads
-- `service_versions`, `entitlements` and `profiles` to decide whether a write
-- is allowed, and RLS would answer those reads with whatever the *writer* may
-- see. A lawyer cannot read `entitlements` at all, so the ownership check would
-- find nothing and refuse a correct delivery with a sentence about somebody
-- else's client; a narrowed policy on `service_versions` would leave the
-- publication check comparing against null, which is not `<> 'published'` and
-- so raises nothing at all. A guard that sees less than the truth fails in both
-- directions, and one of them is silent.

create or replace function public.orders_lifecycle ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service uuid;
  v_review public.review_mode;
  v_version_status public.service_status;
  v_legal public.order_status[];
begin
  v_service := public.version_service (new.service_version_id);

  select sv.review_mode, sv.status into v_review, v_version_status
  from public.service_versions sv where sv.id = new.service_version_id;

  if tg_op = 'INSERT' then
    -- Only from what is on sale. A draft has never been reviewed and a paused
    -- version "has merely stopped accepting orders" — which is what pausing is
    -- for, and would mean nothing if an order could still be placed against
    -- one. An archived version keeps serving the orders already pinned to it.
    if v_version_status <> 'published' then
      raise exception 'service version % is % and cannot be ordered from', new.service_version_id, v_version_status;
    end if;

    if new.status <> 'intake' then
      raise exception 'an order starts in intake';
    end if;
  else
    if new.status is distinct from old.status then
      v_legal := case old.status
        when 'intake' then array['submitted', 'cancelled', 'abandoned']::public.order_status[]
        when 'submitted' then array['generating', 'cancelled']::public.order_status[]
        -- Back to generating from review is a rejection: the lawyer sent it
        -- round again. §6.1 wants that visible, and it is — as a status change
        -- in the log, with the reviewer as the actor.
        when 'generating' then array['in_review', 'delivered', 'cancelled']::public.order_status[]
        when 'in_review' then array['generating', 'delivered', 'cancelled']::public.order_status[]
        -- Delivered is terminal. §8.4's re-issue produces a new document
        -- version and leaves the previous passport untouched; it does not walk
        -- this order backwards.
        else array[]::public.order_status[]
      end;

      if not (new.status = any (v_legal)) then
        raise exception 'an order does not go from % to %', old.status, new.status;
      end if;
    end if;
  end if;

  -- Asking for a human is a request, never a release. Once true it stays true,
  -- or the Art. 22 commitment would be revocable by whoever is generating.
  if tg_op = 'UPDATE' and old.human_review_requested and not new.human_review_requested then
    raise exception 'a request for human review cannot be withdrawn by the platform (Art. 22)';
  end if;

  -- A reviewer is a lawyer. Not "a lawyer assigned to the service": §5.6 makes
  -- the case against locks of that shape, and it is the same case here — the
  -- assigned lawyer is away, the document is due, and a firm that cannot staff
  -- around a lock will keep the lock loose enough never to block anything.
  -- Who *may* be offered the work is `service_assignments`; who took it is
  -- this.
  if new.reviewer_id is not null
    and (tg_op = 'INSERT' or new.reviewer_id is distinct from old.reviewer_id) then
    if not exists (
      select 1 from public.profiles p
      where p.id = new.reviewer_id and p.role = 'lawyer'
    ) then
      raise exception 'an order is reviewed by a lawyer';
    end if;
  end if;

  -- Only ever reached on UPDATE: an insert is fenced to `intake` above, so
  -- there is no path that delivers an order into existence.
  if tg_op = 'UPDATE' and new.status = 'delivered' and old.status <> 'delivered' then
    -- ADR-0005, and the reason it asked for this on the data model: no
    -- configuration lets AI-assembled or AI-written text reach a client
    -- unreviewed, and no code path lets an Art. 22 request be quietly ignored.
    if v_review = 'lawyer_required' or new.human_review_requested then
      if old.status is distinct from 'in_review' then
        raise exception 'this document requires a lawyer; it is delivered out of review or not at all (ADR-0005)';
      end if;
      if new.reviewer_id is null then
        raise exception 'a reviewed document records who reviewed it';
      end if;
    end if;

    -- §8: a document is delivered against something the client bought. Asked of
    -- the entitlement rather than of the client, because this column records
    -- *which* purchase paid for this document — a client covered by a second
    -- entitlement does not make this pointer true.
    if new.entitlement_id is null then
      raise exception 'a delivered order records the entitlement it was issued under (§8.6)';
    end if;

    if not exists (
      select 1 from public.entitlements e
      where e.id = new.entitlement_id and e.client_id = new.client_id
    ) then
      raise exception 'that entitlement belongs to another client';
    end if;

    if not public.entitlement_covers (new.entitlement_id, v_service) then
      raise exception 'the entitlement recorded on this order does not cover the service it is for';
    end if;
  end if;

  -- Stamped here rather than by the caller, for the same reason `published_at`
  -- is: a date somebody passes in can disagree with the log, and then there are
  -- two answers to when a client received their document.
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'submitted' then
      new.submitted_at := coalesce(new.submitted_at, now());
    elsif new.status = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    elsif new.status in ('cancelled', 'abandoned') then
      new.closed_at := coalesce(new.closed_at, now());
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_lifecycle
before insert or update on public.orders
for each row execute function public.orders_lifecycle ();

-- Audit -----------------------------------------------------------------------
--
-- Rule 2. The service is the pinned version's, which puts every order event in
-- the assigned lawyer's cut of the log (§6.2) — the opposite of the entitlement
-- tables, and right for the opposite reason. A purchase is billing; a matter
-- under a service is what the accountable lawyer is accountable for.
--
-- No redaction arguments: there is nothing on this table to redact, which is
-- the whole point of the split ADM-62 made.

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

create trigger orders_audit
after insert or update or delete on public.orders
for each row execute function public.audit_change ();

-- Access ----------------------------------------------------------------------
--
-- ADR-0014 says assignment governs case data, and this table is the matter. It
-- is also the one table in the client half that holds nothing identifying, so
-- the two arms below are narrower than the ADR requires rather than looser than
-- it allows — the narrow predicate lands where the personal data does, on
-- ADM-64's answers and ADM-65's documents, and `reviewer_id` is the column they
-- will key on.
--
--   An admin reads every order. §7.3 says an admin sees a case depersonalised
--   by default, and a row carrying a pseudonym, a version and a status *is* the
--   depersonalised view — there is no second, named version of this table to
--   withhold.
--
--   A lawyer reads the orders of a service they are assigned to, or any order
--   they were made the reviewer of. Both arms are needed and neither is
--   redundant: the first is the queue they pick work from before anyone is
--   assigned, the second is the matter they took, which the lifecycle guard
--   deliberately does not require them to be assigned to.
--
-- No write policy. Orders arrive through the gateway (ADM-5); the console gains
-- its writes with the order card and the review queue (ADM-66, ADM-67), each of
-- which needs a rule about who may move what, and neither of which exists to
-- have that rule tested against.

alter table public.orders enable row level security;

grant select on table public.orders to authenticated;

create policy "orders_select_staff" on public.orders
  for select to authenticated
  using (
    public.jwt_role () = 'admin'
    or (
      public.jwt_role () = 'lawyer'
      and (
        reviewer_id = auth.uid ()
        or public.is_assigned_to (public.version_service (service_version_id))
      )
    )
  );

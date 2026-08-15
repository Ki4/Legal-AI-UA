-- Entitlements: what a client bought, until when, and which services it covers
-- (spec §8.6; Q10 and Q11 in §14 are the answers this implements).
--
-- §8.3 predicted the shape and it holds. There is **one** staleness mechanism,
-- not two systems: both purchase models resolve to the same relation —
-- entitlement → covered services — and the entitlement decides only what
-- happens once a covered service goes stale. A subscriber gets the refreshed
-- document; a one-off buyer gets a notification and an offer.
--
-- Four tables, and the asymmetry between the two pairs is the design:
--
--   `plans` and `plan_services` are catalogue. A plan is a product the firm
--   sells and the services it covers are a commercial decision. Nothing here is
--   about any particular client, so role is the right instrument (ADR-0014) and
--   staff read them the way they read the catalogue.
--
--   `entitlements` and `entitlement_services` are about one client. They carry
--   no personal data — `client_id` is the pseudonymous anchor of ADM-62 — but
--   what somebody bought is billing, and ADR-0014 puts billing in
--   administration rather than in the case. So the rows are admin-only, and the
--   question a lawyer's screen actually asks is answered by a function instead:
--   `client_is_entitled_to`.
--
-- Coverage reaches a service by two routes and no caller should have to know
-- which: a one-off names its services directly, a subscription inherits them
-- from its plan. Every consumer goes through that one function, which is the
-- single relation §8.6 asked for rather than two joins each caller writes again
-- and one of them writes wrong.
--
-- **Coverage is per service, never per version.** An order pins a version
-- (ADR-0009) because a document has to stay explainable years later; an
-- entitlement covers the product, because the entire promise of §8 is that the
-- client keeps receiving the current one. Pinning coverage to a version would
-- mean a client stopped being covered the moment the firm improved the service
-- they had paid for.
--
-- **A plan has no price row, and that is deliberate.** `service_version_prices`
-- is a per-currency amount frozen with the version it belongs to. A
-- subscription price is not that shape: it recurs, so it carries a period, and
-- §8 leaves the period genuinely ambiguous — it names an *annual* subscription
-- and records a *monthly* figure. Q9 is open on the amounts besides. Inventing
-- a period here would be answering an open question by writing a column name.

create type public.entitlement_kind as enum ('one_off', 'subscription');

-- Plans -----------------------------------------------------------------------
--
-- Keyed by code, for the reasons `practice_areas` gives at length: a handful of
-- rows have no use for a surrogate id, and the code is what makes a plan
-- readable in a URL, in a log payload and in this file. It is immutable for the
-- same reason an area code is — entitlements refer to it, and a code that once
-- meant something has to keep meaning it.
--
-- Its labels are columns rather than i18n keys, again following
-- `practice_areas`: an admin creates a plan at runtime, and a key in
-- `packages/i18n` can only be added by a deploy. No seed rows — §8 settles that
-- subscriptions exist and leaves which plans exist to the firm.

create table public.plans (
  code text primary key,
  label_uk text not null,
  label_en text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint plans_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

comment on table public.plans is
  'A subscription product. What it covers is plan_services; what it costs is not modelled yet — see the migration header.';

comment on column public.plans.is_active is
  'A retired plan. Entitlements already granted against it keep resolving; it stops being offered for new ones.';

create or replace function public.plans_guard_code ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'a plan code is permanent; entitlements already refer to it';
  end if;
  return new;
end;
$$;

create trigger plans_code_immutable
before update on public.plans
for each row execute function public.plans_guard_code ();

create table public.plan_services (
  plan_code text not null references public.plans (code) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (plan_code, service_id)
);

comment on table public.plan_services is
  'Which services a plan covers (§8.6). Cascades on both sides: this is a catalogue statement, not a record of a purchase.';

create index plan_services_by_service on public.plan_services (service_id);

-- Entitlements ----------------------------------------------------------------

create table public.entitlements (
  id uuid primary key default gen_random_uuid (),

  -- `restrict`, not `cascade`. §7 keeps financial records where retention law
  -- requires them and anonymises instead of deleting, so a client row that
  -- somehow got deleted must not take the record of what they paid for with
  -- it. Erasure does not go near this: `erase_client` destroys the mapping and
  -- leaves the anchor standing precisely so that rows like this one keep
  -- resolving.
  client_id uuid not null references public.clients (id) on delete restrict,

  kind public.entitlement_kind not null,
  plan_code text references public.plans (code) on delete restrict,

  valid_from timestamptz not null default now(),
  valid_until timestamptz,

  -- A term that ended is not the same fact as a purchase that was undone. A
  -- refund, a chargeback, a subscription cancelled for cause: those stop
  -- coverage now, and leaving that to be expressed by moving `valid_until`
  -- backwards would make a paid term and a revoked one indistinguishable
  -- afterwards.
  revoked_at timestamptz,

  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  -- Q11: the subscription is to the platform and the plan decides coverage.
  -- Q10: a one-off covers a set of services and a package is not a third kind.
  -- Both directions are checked, so neither a planless subscription nor a
  -- one-off wearing a plan can exist.
  constraint entitlements_plan_follows_kind check (
    (kind = 'subscription') = (plan_code is not null)
  ),

  -- §8.1 is what makes this asymmetric rather than fussy. A one-off was sold on
  -- "valid until the law changes", which makes its lifetime a function of
  -- legislation and not of a date; an end date on it would be a second and
  -- contradictory answer to the one question a client will ask. A subscription
  -- is a term, so it has one.
  constraint entitlements_term_follows_kind check (
    case kind
      when 'subscription' then valid_until is not null
      when 'one_off' then valid_until is null
    end
  ),

  constraint entitlements_term_is_ordered check (
    valid_until is null or valid_until > valid_from
  )
);

comment on table public.entitlements is
  'What one client bought (§8.6). Pseudonymous — client_id is the ADM-62 anchor — but billing, so administration reads it and a lawyer does not.';

comment on column public.entitlements.valid_until is
  'The term of a subscription. Null on a one-off, whose validity ends when the law moves, not on a date (§8.1).';

comment on column public.entitlements.revoked_at is
  'Coverage withdrawn — refund, chargeback, cancellation for cause. Distinct from a term that simply ended.';

create index entitlements_by_client on public.entitlements (client_id);

create table public.entitlement_services (
  entitlement_id uuid not null references public.entitlements (id) on delete cascade,

  -- `restrict` here where `plan_services` cascades, and the difference is the
  -- point. Removing a service from a plan is an ordinary commercial edit.
  -- Deleting a service somebody has bought would erase the evidence of what
  -- they bought, so a sold service is not deletable — which is the correct
  -- answer and the one nobody would think to ask for.
  service_id uuid not null references public.services (id) on delete restrict,

  primary key (entitlement_id, service_id)
);

comment on table public.entitlement_services is
  'The services a one-off covers. A package is several rows here, not a third kind of entitlement (Q10).';

create index entitlement_services_by_service on public.entitlement_services (service_id);

-- A subscription's coverage comes from its plan. Listing services on one would
-- be a second answer to a question that already has one, and the two would
-- diverge the first time a plan changed.
create or replace function public.entitlement_services_guard_kind ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select e.kind from public.entitlements e where e.id = new.entitlement_id
  ) = 'subscription' then
    raise exception 'a subscription covers what its plan covers; naming services on it would be a second answer';
  end if;
  return new;
end;
$$;

create trigger entitlement_services_only_on_one_off
before insert or update on public.entitlement_services
for each row execute function public.entitlement_services_guard_kind ();

-- A one-off covering nothing is a purchase that granted nothing. It cannot be a
-- CHECK — the rows live in another table — so it is a constraint trigger, and
-- deferred because the entitlement and its first covered service are two
-- statements. Anything inserting an entitlement must therefore insert its
-- services in the same transaction, which is what a purchase is anyway.
create or replace function public.entitlements_guard_coverage ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'one_off' and not exists (
    select 1 from public.entitlement_services es where es.entitlement_id = new.id
  ) then
    raise exception 'a one-off entitlement covers at least one service (§8.6)';
  end if;
  return null;
end;
$$;

create constraint trigger entitlements_cover_something
after insert or update on public.entitlements
deferrable initially deferred
for each row execute function public.entitlements_guard_coverage ();

-- The other half of the same rule: emptying the list afterwards is the same
-- state arrived at from the other side.
--
-- The existence test is not defensive. `on delete cascade` from `entitlements`
-- deletes the parent row first and the children after, so during a cascade this
-- trigger correctly finds no parent and stands aside — which is what lets an
-- entitlement be deleted at all.
create or replace function public.entitlement_services_guard_last ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.entitlements e
    where e.id = old.entitlement_id and e.kind = 'one_off'
  ) and not exists (
    select 1 from public.entitlement_services es
    where es.entitlement_id = old.entitlement_id
      and es.service_id is distinct from old.service_id
  ) then
    raise exception 'this is the only service the entitlement covers; delete the entitlement instead';
  end if;
  return old;
end;
$$;

create trigger entitlement_services_keep_one
before delete on public.entitlement_services
for each row execute function public.entitlement_services_guard_last ();

-- The one relation §8.6 asked for --------------------------------------------
--
-- Two routes to coverage and two questions asked about it, so: one primitive
-- and one wrapper, never two implementations that drift.
--
--   `entitlement_covers` is the primitive. Is *this* purchase live, and does it
--   reach this service — directly, because a one-off names it, or through the
--   plan a subscription was granted against? An order records which entitlement
--   paid for it, so this is the question its delivery guard asks (ADM-63).
--
--   `client_is_entitled_to` is the question a screen asks before there is an
--   order at all: may this client have this service from anything they hold?
--   It is the primitive under an exists, which is the whole of the difference.
--
-- SECURITY DEFINER on both because the answer is staff business and the rows
-- are administration: a lawyer may learn that a client is covered without being
-- able to read what they paid or when they bought it.

create or replace function public.entitlement_covers (target_entitlement uuid, target_service uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.id = target_entitlement
      and e.revoked_at is null
      and e.valid_from <= now()
      and (e.valid_until is null or e.valid_until > now())
      and (
        exists (
          select 1 from public.entitlement_services es
          where es.entitlement_id = e.id
            and es.service_id = target_service
        )
        or exists (
          select 1 from public.plan_services ps
          where ps.plan_code = e.plan_code
            and ps.service_id = target_service
        )
      )
  );
$$;

comment on function public.entitlement_covers (uuid, uuid) is
  'Is this entitlement live, and does it reach this service by either route (§8.6)? The single definition of covered.';

create or replace function public.client_is_entitled_to (target_client uuid, target_service uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.client_id = target_client
      and public.entitlement_covers (e.id, target_service)
  );
$$;

comment on function public.client_is_entitled_to (uuid, uuid) is
  'Does this client hold anything that covers this service? entitlement_covers under an exists — the same definition, asked without an order.';

revoke all on function public.entitlement_covers (uuid, uuid) from public, anon;
grant execute on function public.entitlement_covers (uuid, uuid) to authenticated;

revoke all on function public.client_is_entitled_to (uuid, uuid) from public, anon;
grant execute on function public.client_is_entitled_to (uuid, uuid) to authenticated;

-- Audit -----------------------------------------------------------------------
--
-- `audit_change` raises for a table it has no mapping for, which is what makes
-- this block compulsory rather than easy to forget.
--
-- `plans` gets no trigger, for the reason `practice_areas` already gives:
-- `audit_events.entity_id` is a uuid and a plan is keyed by its code. What
-- matters about a plan is which services it covers, and that is `plan_services`
-- below, where the service supplies the id.
--
-- The `service_id` column decides who sees the event, because the lawyer's cut
-- of the log keys on assignment. The three mappings here split on exactly that:
--
--   `plan_services` carries its service. A service being added to or dropped
--   from a plan changes who is entitled to order it, and the lawyer accountable
--   for that service should see it happen.
--
--   `entitlements` and `entitlement_services` carry null. What one client
--   bought is billing, and billing is administration (ADR-0014). A lawyer
--   assigned to a popular service has no business watching purchases of it roll
--   past — and the null is what keeps the row out of their cut without a second
--   policy having to say so.

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
      -- Composite key with a text half. The service is the entity and the plan
      -- code is in the payload, the same way an assignment records the service
      -- and puts the lawyer in the payload.
      v_entity := (v_row ->> 'service_id')::uuid;
      v_service := v_entity;
    when 'entitlements' then
      v_entity := (v_row ->> 'id')::uuid;
      v_service := null;
    when 'entitlement_services' then
      v_entity := (v_row ->> 'entitlement_id')::uuid;
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

create trigger plan_services_audit
after insert or update or delete on public.plan_services
for each row execute function public.audit_change ();

-- No redaction arguments on either: neither table holds anything to redact.
-- `client_id` is a pseudonym, which is what §7.1 built it to be.
create trigger entitlements_audit
after insert or update or delete on public.entitlements
for each row execute function public.audit_change ();

create trigger entitlement_services_audit
after insert or update or delete on public.entitlement_services
for each row execute function public.audit_change ();

-- Access ----------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.plan_services enable row level security;
alter table public.entitlements enable row level security;
alter table public.entitlement_services enable row level security;

-- The catalogue half. A lawyer reads which plans cover their service for the
-- same reason they read the service's price: it is what the firm is selling,
-- and they are accountable for it. Deciding it stays commercial.

grant select, insert, update, delete on table public.plans to authenticated;

create policy "plans_select_staff" on public.plans
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "plans_write_admin" on public.plans
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

grant select, insert, update, delete on table public.plan_services to authenticated;

create policy "plan_services_select_staff" on public.plan_services
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "plan_services_write_admin" on public.plan_services
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

-- The billing half. ADR-0014 lists billing among the things administration
-- means, next to users, the catalogue and versions — so the admin reading these
-- rows is the ADR's own example rather than an exception to it, and the rows
-- hold no personal data for the depersonalisation rule of §7.3 to bite on.
--
-- A lawyer gets no policy here at all. They have `client_is_entitled_to` for
-- the only question their screens ask, and a yes/no is the whole of what a
-- draft needs to know about a purchase.
--
-- **The refusal is silent, and it cannot be made loud.** `client_identities`
-- fails with a permission error because its grant is withheld from everybody.
-- Here an admin has to read the rows, and an admin and a lawyer reach Postgres
-- as the same database role — `authenticated`, with the distinction in the JWT,
-- which a grant cannot see. So the grant is unavoidable and the policy is what
-- filters, which means a lawyer meets the empty array §13 warns about. That is
-- the second reason `client_is_entitled_to` exists: no lawyer-facing screen
-- reads these tables, so nothing ever has to tell "you may not see this" apart
-- from "there is nothing to see".
--
-- Writes are admin's rather than nobody's, unlike `clients`. Granting a comped
-- subscription, recording a refund, moving a service between plans: those are
-- administrative acts somebody performs deliberately, they land in the audit
-- log like every other write, and refusing them would mean the only way to fix
-- a billing mistake is a migration. The *purchase* path is still the gateway's
-- (ADM-5) and still does not exist.

grant select, insert, update, delete on table public.entitlements to authenticated;

create policy "entitlements_admin" on public.entitlements
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

grant select, insert, update, delete on table public.entitlement_services to authenticated;

create policy "entitlement_services_admin" on public.entitlement_services
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

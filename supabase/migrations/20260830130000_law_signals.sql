-- The triage queue, and what confirming an impact costs (§9.11, §9.16, Q5-Q8).
--
-- `20260830120000` records what an article said. This records what somebody
-- decided about it changing — the other half, and the half with consequences
-- outside the building.
--
-- **The shape of this table was derived rather than guessed.** `decideProbe` and
-- `decideTriage` in `packages/law-refs` are pure functions with 49 scenarios
-- between them, and every column here is something one of them returns. That
-- ordering was deliberate: the rules are cheap to argue with while they are a
-- function and expensive once they are a schema, and the two most costly
-- decisions this product makes — taking a service off sale, and telling every
-- client holding a document that it is wrong — are decided in those functions.
--
-- **What is not here: a notification table.** §10 defers client-facing
-- notification until `apps/web` and real orders exist, and overtaking that
-- sequencing quietly would be the wrong kind of initiative. What this table
-- holds instead is the *obligation*: who was owed a message and when it fell
-- due is derivable from a resolved signal plus the reverse index of §8.1, which
-- Q8's answer needs built anyway. A list of recipients stored here would be a
-- copy of that index, going stale from the moment it was written.

-- Vocabulary ---------------------------------------------------------------------
--
-- Five states, and the two that look redundant are the two that matter.
--
-- `scheduled` and `impact_confirmed` are the same legal judgement — the document
-- is wrong — separated only by whether the law is in force yet, and that
-- separation is worth a value of its own because it is what decides whether a
-- live service comes off sale today (Q5, Q7). Collapsing them would either pause
-- services for rules nobody has to follow yet, or fail to pause them at all.
--
-- `resolved_no_impact` is the path §9.11 says carries more weight than it looks:
-- most amendments to a large code do not touch the provision a template rests
-- on, and if every drift forced a template update the system would become a
-- source of false alarms and lawyers would stop reading it.
create type public.law_signal_state as enum (
  -- Raised by the fetcher, awaiting a lawyer. §9.16 starts its clock here.
  'open',
  -- A lawyer has picked it up and is reading the diff.
  'under_review',
  -- Changed, and it does not touch what the service relies on.
  'resolved_no_impact',
  -- It changes the document and the law is in force. This is what pauses.
  'impact_confirmed',
  -- It changes the document and the law is not in force yet (§9.9).
  'scheduled'
);

-- Which of `ProbeVerdict` raised this. Only the drifting ones ever do: an
-- unreachable norm is a health matter (§9.10, ADM-49) with no diff to read, and
-- putting it in this queue would dilute the queue with work nobody can do.
create type public.law_signal_cause as enum (
  -- The publisher's text moved.
  'drifted',
  -- The normalizer moved and no stored text existed to tell the two apart. The
  -- fetcher errs towards the alarm; this value is how often that happens.
  'drifted_indeterminate'
);

-- The queue ------------------------------------------------------------------------

create table public.law_signals (
  id uuid primary key default gen_random_uuid (),

  norm_id uuid not null references public.law_norms (id) on delete restrict,

  cause public.law_signal_cause not null,

  -- What to read. The diff a lawyer is given is these two texts, which is the
  -- whole reason `law_norm_revisions` keeps text rather than only hashes.
  revision_id uuid not null references public.law_norm_revisions (id) on delete restrict,
  -- Null only for a signal on a norm whose history starts at the new revision.
  previous_revision_id uuid references public.law_norm_revisions (id) on delete restrict,

  raised_at timestamptz not null default now(),

  state public.law_signal_state not null default 'open',

  -- §9.9. The date the amending act takes effect, when it stated one. Required
  -- for `scheduled`, because that state means nothing without it.
  effective_date date,

  -- Who decided, and when. §9.11: marking a drift harmless is a legal judgement
  -- recorded with its author, not a housekeeping flag.
  triaged_by uuid references auth.users (id),
  triaged_at timestamptz,

  -- §9.16, set at triage rather than fixed in policy: only the person who read
  -- the diff can judge severity, and a law taking effect in three months is not
  -- the same urgency as one that made yesterday's delivered document wrong.
  remediation_due date,

  -- What they decided and why, in their words. The counterpart of `relied_on`.
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint law_signals_revisions_differ
    check (previous_revision_id is null or previous_revision_id <> revision_id),

  -- A decision has an author. Everything past `open` is somebody's doing.
  constraint law_signals_decided_by_a_person check (
    state = 'open'
      or (triaged_by is not null and triaged_at is not null)
  ),

  -- A resolution says why. `under_review` does not yet, because nothing has been
  -- resolved — picking a signal up is not deciding it.
  constraint law_signals_resolution_is_explained check (
    state in ('open', 'under_review')
      or (resolution_note is not null and length(btrim(resolution_note)) > 0)
  ),

  -- §9.16's tracked date exists exactly where something is owed. Requiring it on
  -- `resolved_no_impact` would ask a lawyer to schedule work they just decided is
  -- unnecessary; allowing it to be absent on the other two would be a promise
  -- with no date on it.
  constraint law_signals_remediation_date_where_owed check (
    (state in ('impact_confirmed', 'scheduled') and remediation_due is not null)
      or (state not in ('impact_confirmed', 'scheduled') and remediation_due is null)
  ),

  -- `scheduled` is precisely "not in force yet", so the date is the state.
  constraint law_signals_scheduled_has_its_date check (
    state <> 'scheduled' or effective_date is not null
  ),

  -- The rule `decideTriage` refuses in the console and the database refuses
  -- here: a fix due after the law lands means the service is knowingly wrong on
  -- the one day §9.9 exists to let us get ahead of.
  constraint law_signals_fix_lands_before_the_law check (
    state <> 'scheduled' or remediation_due <= effective_date
  )
);

comment on table public.law_signals is
  'One drift, awaiting or carrying a lawyer''s decision (§9.11, §9.16). Its shape follows decideProbe and decideTriage in packages/law-refs.';

comment on column public.law_signals.state is
  'scheduled and impact_confirmed are one judgement split by whether the law is in force — which is what decides whether a live service pauses today (Q5, Q7).';

-- **One signal awaiting triage per norm, and this is the constraint behind a
-- rule that already exists in code.** `decideProbe` takes `hasOpenSignal` and
-- declines to queue a second entry while the first is unread: a second amendment
-- arriving before a lawyer has opened the first is one piece of work, not two,
-- and §9.4's failure — a lawyer who stops opening alerts — is reached by
-- repeating a true alarm just as surely as by raising false ones.
--
-- `scheduled` is deliberately outside the predicate. It has been triaged; a
-- *further* change to the same article afterwards is a new question, and
-- refusing to raise it would be the one silence this whole section is against.
create unique index law_signals_one_awaiting_triage
  on public.law_signals (norm_id)
  where state in ('open', 'under_review');

-- The triage queue reads oldest-first: §9.16 gives one business day from
-- notification, so the queue is ordered by the clock that is running.
create index law_signals_by_age on public.law_signals (state, raised_at asc);

-- ADM-47's calendar: what lands, and when.
create index law_signals_by_effective_date
  on public.law_signals (effective_date asc)
  where effective_date is not null;

create trigger law_signals_touch_updated_at
before update on public.law_signals
for each row execute function public.touch_updated_at ();

-- The revisions have to be this norm's ------------------------------------------
--
-- A foreign key proves each revision exists; nothing in it proves they belong to
-- the norm the signal is about. A signal pairing article 105's old text with
-- article 26's new one would render a diff between two unrelated provisions, and
-- it would render it confidently — a lawyer would read it and decide something.
-- Not expressible as a check constraint, so it is a trigger.

create or replace function public.law_signals_guard_revisions ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm uuid;
begin
  select norm_id into v_norm from public.law_norm_revisions where id = new.revision_id;
  if v_norm is distinct from new.norm_id then
    raise exception
      'signal names norm % and a revision belonging to norm %', new.norm_id, v_norm;
  end if;

  if new.previous_revision_id is not null then
    select norm_id into v_norm
    from public.law_norm_revisions where id = new.previous_revision_id;
    if v_norm is distinct from new.norm_id then
      raise exception
        'signal names norm % and a previous revision belonging to norm %', new.norm_id, v_norm;
    end if;
  end if;

  return new;
end;
$$;

create trigger law_signals_guard_revisions
before insert or update on public.law_signals
for each row execute function public.law_signals_guard_revisions ();

-- Q5: a confirmed impact takes the service off sale ------------------------------
--
-- The most expensive thing this product does, so it is a trigger rather than a
-- step in a handler: it must not be possible to confirm an impact and forget the
-- consequence. `service_versions` already supports the transition — its
-- lifecycle guard says status may move among the post-publication values, "that
-- is how pause, archive and reinstatement work" — so this uses the vocabulary
-- the catalogue already has rather than inventing a second one.
--
-- **Only `impact_confirmed`.** A `scheduled` signal names a law that is not in
-- force, and pausing for it would take a service off sale for a rule nobody has
-- to follow yet. That is Q7's answer meeting Q5's, and the pair is settled in
-- §14 rather than left to whoever writes the screen.
--
-- **And nothing here ever un-pauses.** Reinstatement is publishing the new
-- version, which is a person's act with its own audit trail — and a service can
-- rest on several norms, so lifting a pause because *one* signal resolved would
-- put a document back on sale that another confirmed impact still makes wrong.

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

  update public.service_versions sv
  set status = 'paused'
  where sv.status = 'published'
    and exists (
      select 1 from public.service_law_refs r
      where r.service_id = sv.service_id and r.norm_id = new.norm_id
    );

  return null;
end;
$$;

comment on function public.law_signals_pause_affected_services () is
  'Q5: a confirmed impact takes every published version resting on the norm off sale. Never un-pauses — reinstatement is publishing the fix.';

create trigger law_signals_pause_affected_services
after insert or update on public.law_signals
for each row execute function public.law_signals_pause_affected_services ();

-- Audit ---------------------------------------------------------------------------
--
-- A triage decision is the clearest "who did what" in this whole area — §9.11
-- calls it a legal judgement rather than a housekeeping flag — so it is audited
-- even though the row already carries `triaged_by`. The column says who holds it
-- now; the log says who moved it, from what, and when, which is the question
-- asked six months later when somebody wants to know why a service was paused.
--
-- `service_id` is null, like `law_norms` and for the same reason: ten services
-- may rest on one norm and there is no honest single value. The pause itself
-- lands in the per-service cut, because `service_versions` is audited and the
-- trigger above updates it.
--
-- `audit_change` raises for a table it has no mapping for, so this restatement
-- is the mapping being added rather than a copy for its own sake.

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

create trigger law_signals_audit
after insert or update or delete on public.law_signals
for each row execute function public.audit_change ();

-- Access ----------------------------------------------------------------------------
--
-- **Read like the register**: §4.11 and §4.12 show a lawyer the queue, and a
-- signal is firm knowledge rather than one service's property.
--
-- **Raised only by the fetcher.** No insert grant: a signal means "a machine
-- observed a change", and one typed by a person would be a claim with no
-- revision behind it. A lawyer who wants to record a concern has the norm's own
-- fields and the audit log.
--
-- **Triaged by whoever answers for the service**, which is the same predicate
-- `law_norms` uses — admin, or a lawyer assigned to a service resting on the
-- norm. Column-level again, and for the reason `20260830120000` had to add it
-- retroactively: a table-level grant is a grant on `raised_at` and `cause` too,
-- and a triage screen has no business rewriting what the fetcher observed.

alter table public.law_signals enable row level security;

grant select on table public.law_signals to authenticated;

grant update (state, triaged_by, triaged_at, remediation_due, resolution_note, effective_date)
  on table public.law_signals to authenticated;

create policy "law_signals_select_staff" on public.law_signals
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "law_signals_update_admin_or_dependent_lawyer" on public.law_signals
  for update to authenticated
  using (
    public.jwt_role () = 'admin'
    or (
      public.jwt_role () = 'lawyer'
      and exists (
        select 1 from public.service_law_refs r
        where r.norm_id = law_signals.norm_id and public.is_assigned_to (r.service_id)
      )
    )
  )
  with check (
    public.jwt_role () = 'admin'
    or (
      public.jwt_role () = 'lawyer'
      and exists (
        select 1 from public.service_law_refs r
        where r.norm_id = law_signals.norm_id and public.is_assigned_to (r.service_id)
      )
    )
  );

-- Publication is three acts, and the professional one is a lawyer's. ADR-0027.
--
-- Until now `published_at` was the whole of publication: an admin's column,
-- and nothing between a lawyer's draft and a client was signed by a lawyer.
-- The product owner's position (Q28, 2026-09-18) is that approving a legal
-- service is an expert judgement a technical admin should not own. So:
--
--   author ──► in_review ──► released ──────────────► published
--   assigned      "ready"     a signatory of the        an admin, and only
--   lawyer                    service's practice area   of a released version
--
-- Three pieces, none of them a role:
--
--   * `practice_area_signatories` — who signs for an area. Exactly one
--     `is_head` per area, set by an admin (an organisational fact, like
--     assignment). Any number of release reviewers, appointed by the head in
--     their own area (an expert judgement: who is fit to check a colleague's
--     work — the same reason the accountable lawyer arranges their own cover
--     in `20260811160000`). A reviewer signs in one area and it says nothing
--     about another.
--   * `released_by` / `released_at` on `service_versions` — the signature.
--     Two columns and not a status: a status can be walked back to draft and
--     then nobody knows who signed; a column is a fact. Set only through
--     `release_service_version()`. Any edit to the version's content after
--     release, on the row or on its blocks, clears it — the signature stood
--     under one text, not under whatever the text becomes.
--   * Four eyes, enforced when there are four. A signatory may not release a
--     version they authored (`created_by`, new) — unless the area has no other
--     signatory, which is the founding case. Then the release goes through with
--     `self_released = true`, which lands in the audit row as a plain column and
--     counts how often the rule could not be applied. The remedy is one
--     appointment, in the head's own hands.
--
-- The sale stays the admin's: `published_at` is set as before, and refuses a
-- version nobody released. That is the one word §13 changes — the split is still
-- commercial versus professional, and the professional half now has a signature
-- in it.
--
-- Not checked here, deliberately: that the template version the release binds
-- is frozen. Templates are not in the schema yet (ADM-1, ADM-30); the check
-- belongs to the migration that brings them, and this comment is where that
-- debt is written down.

-- Who signs for an area ---------------------------------------------------------

create table public.practice_area_signatories (
  practice_area text not null references public.practice_areas (code)
    on update restrict on delete restrict,
  lawyer_id uuid not null references public.profiles (id) on delete cascade,
  is_head boolean not null default false,
  appointed_at timestamptz not null default now(),
  appointed_by uuid,
  primary key (practice_area, lawyer_id)
);

comment on table public.practice_area_signatories is
  'Who may release a service version in an area as professionally correct (ADR-0027). Exactly one is_head per area; the rest are release reviewers the head appoints.';

create unique index practice_area_signatories_one_head
  on public.practice_area_signatories (practice_area)
  where is_head;

create index practice_area_signatories_by_lawyer
  on public.practice_area_signatories (lawyer_id);

-- A signatory is a lawyer. That is a statement about the person and not about
-- the hat they are wearing, so it reads the held set (ADR-0026) — the table,
-- never the claim.
create or replace function public.practice_area_signatories_guard_lawyer ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_roles r
    where r.user_id = new.lawyer_id and r.role = 'lawyer'
  ) then
    raise exception 'a signatory has to hold the lawyer role';
  end if;

  return new;
end;
$$;

create trigger practice_area_signatories_guard_lawyer
before insert or update on public.practice_area_signatories
for each row execute function public.practice_area_signatories_guard_lawyer ();

-- Membership helpers. SECURITY DEFINER for the reason `is_assigned_to` gives:
-- they are called from policies on this table and would otherwise re-enter its
-- own RLS to answer the question RLS is asking.

create or replace function public.signs_for_area (target_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.practice_area_signatories s
    where s.practice_area = target_area and s.lawyer_id = auth.uid ()
  );
$$;

create or replace function public.is_head_of (target_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.practice_area_signatories s
    where s.practice_area = target_area and s.lawyer_id = auth.uid () and s.is_head
  );
$$;

-- The signature on a version ----------------------------------------------------

alter table public.service_versions
  add column created_by uuid references public.profiles (id) on delete set null
    default auth.uid (),
  add column released_at timestamptz,
  add column released_by uuid references public.profiles (id) on delete set null,
  add column self_released boolean not null default false;

comment on column public.service_versions.created_by is
  'Who authored the version. Read by the four-eyes rule: the author may not also be the signatory.';
comment on column public.service_versions.released_at is
  'When a signatory of the practice area released this version as professionally correct (ADR-0027). Cleared by any later content edit.';
comment on column public.service_versions.released_by is
  'The signatory. Set only through release_service_version().';
comment on column public.service_versions.self_released is
  'The author signed their own version because the area had no other signatory. A count of how often four eyes were not available, not a permission.';

-- Versions on sale before this migration went there under the old rule, where
-- publication was the whole act. They are stamped released at the moment they
-- were published and `released_by` stays null: nobody signed, and the row says
-- so rather than borrowing the admin's name for a professional act.
update public.service_versions
set released_at = published_at
where published_at is not null and released_at is null;

-- Sale requires the signature, as a constraint rather than only a trigger:
-- constraints are checked after every before-trigger has had its say, so a
-- statement that publishes and edits content in one go — which withdraws the
-- release — cannot leave a published row with no signature on it.
alter table public.service_versions
  add constraint service_versions_sale_requires_release check (
    published_at is null or released_at is not null
  ),
  add constraint service_versions_self_release_is_a_release check (
    not self_released or released_at is not null
  );

-- Publication: the admin's act, refused for an unreleased version. Restated
-- from `20260811160000_service_assignments.sql`, the last migration to define
-- it, plus the one new refusal.
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

-- Freeze: a published version's signature is part of what is frozen. Restated
-- from `20260811140000_service_version_lifecycle_guards.sql`, the last migration
-- to define it, plus the four new columns.
create or replace function public.service_versions_freeze ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is null then
    return new;
  end if;

  if new.status in ('draft', 'in_review') then
    raise exception
      'service version % has been published; it cannot return to % (ADR-0009)',
      old.id, new.status;
  end if;

  if new.service_id is distinct from old.service_id
    or new.version is distinct from old.version
    or new.generation_mode is distinct from old.generation_mode
    or new.review_mode is distinct from old.review_mode
    or new.published_at is distinct from old.published_at
    or new.published_by is distinct from old.published_by
    or new.created_by is distinct from old.created_by
    or new.released_at is distinct from old.released_at
    or new.released_by is distinct from old.released_by
    or new.self_released is distinct from old.self_released then
    raise exception 'service version % is published; its content is frozen (ADR-0009)', old.id;
  end if;

  return new;
end;
$$;

-- The signature is set by the RPC and by nothing else. A signatory who is also
-- assigned could otherwise write `released_at` through the lawyer policy, and an
-- admin through theirs. Clearing it is allowed from anywhere: that is what any
-- content edit does, and withdrawing a signature is never the dangerous
-- direction.
--
-- Guarded on "inside a request" rather than on a role, as the catalogue-column
-- guard is: a seed or a migration running as postgres has no JWT and must not
-- be caught by this.
create or replace function public.service_versions_release_guard ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.jwt_role () is null then
    return new;
  end if;

  if coalesce(current_setting('legal_ai.releasing', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.released_at is not null or new.released_by is not null or new.self_released then
      raise exception
        'a release is signed through release_service_version(), not written (ADR-0027)';
    end if;
    return new;
  end if;

  if (new.released_at is not null and new.released_at is distinct from old.released_at)
    or (new.released_by is not null and new.released_by is distinct from old.released_by)
    or (new.self_released and not old.self_released) then
    raise exception
      'a release is signed through release_service_version(), not written (ADR-0027)';
  end if;

  return new;
end;
$$;

create trigger service_versions_release_guard
before insert or update on public.service_versions
for each row execute function public.service_versions_release_guard ();

-- An edit withdraws the signature. Content is the columns the freeze guards
-- plus the lifecycle step back to draft — a version pulled back to draft is
-- being reworked, whatever the columns say. A published version never gets
-- here: the freeze trigger has already refused the edit.
create or replace function public.service_versions_withdraw_release ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.released_at is null or new.published_at is not null then
    return new;
  end if;

  if new.generation_mode is distinct from old.generation_mode
    or new.review_mode is distinct from old.review_mode
    or new.version is distinct from old.version
    or new.service_id is distinct from old.service_id
    or new.status = 'draft' then
    new.released_at := null;
    new.released_by := null;
    new.self_released := false;
  end if;

  return new;
end;
$$;

-- Fires after the release guard (alphabetical), so a statement that both edits
-- content and forges a signature is refused before the edit withdraws it.
create trigger service_versions_withdraw_release
before update on public.service_versions
for each row execute function public.service_versions_withdraw_release ();

-- Blocks are the text the signature stands under. A block written, changed or
-- removed on a released, unpublished version withdraws the release.
create or replace function public.document_blocks_withdraw_release ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version uuid;
begin
  v_version := coalesce(new.service_version_id, old.service_version_id);

  update public.service_versions
  set released_at = null, released_by = null, self_released = false
  where id = v_version and released_at is not null and published_at is null;

  return null;
end;
$$;

create trigger document_blocks_withdraw_release
after insert or update or delete on public.document_blocks
for each row execute function public.document_blocks_withdraw_release ();

-- The act of signing ------------------------------------------------------------

create or replace function public.release_service_version (target_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service uuid;
  v_area text;
  v_status public.service_status;
  v_published timestamptz;
  v_released timestamptz;
  v_author uuid;
  v_self boolean;
begin
  if public.jwt_role () is distinct from 'lawyer' then
    raise exception 'only a lawyer signs a release (ADR-0027)';
  end if;

  select sv.service_id, sv.status, sv.published_at, sv.released_at, sv.created_by, s.practice_area
  into v_service, v_status, v_published, v_released, v_author, v_area
  from public.service_versions sv
  join public.services s on s.id = sv.service_id
  where sv.id = target_version;

  if v_service is null then
    raise exception 'no such service version';
  end if;

  if v_published is not null then
    raise exception 'service version % is published; there is nothing left to sign', target_version;
  end if;

  if v_released is not null then
    raise exception 'service version % is already released; one signature per text', target_version;
  end if;

  if v_status <> 'in_review' then
    raise exception
      'service version % is %; only a version in review is released', target_version, v_status;
  end if;

  if not public.signs_for_area (v_area) then
    raise exception 'you do not sign for practice area %', v_area;
  end if;

  v_self := v_author = auth.uid ();

  if v_self and exists (
    select 1 from public.practice_area_signatories s
    where s.practice_area = v_area and s.lawyer_id <> auth.uid ()
  ) then
    raise exception
      'you authored this version; another signatory of % has to release it (ADR-0027)', v_area;
  end if;

  perform set_config('legal_ai.releasing', 'on', true);

  update public.service_versions
  set released_at = now(),
      released_by = auth.uid (),
      self_released = coalesce(v_self, false)
  where id = target_version;

  perform set_config('legal_ai.releasing', '', true);
end;
$$;

revoke all on function public.release_service_version (uuid) from public, anon;
grant execute on function public.release_service_version (uuid) to authenticated;

-- Setting the head, atomically. Same shape as `set_primary_lawyer`, for the
-- same reason: two statements from a browser are two chances to leave an area
-- with no head or with two.
create or replace function public.set_area_head (target_area text, new_head uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.jwt_role () is distinct from 'admin' then
    raise exception 'only admins can change who heads a practice area';
  end if;

  if not exists (select 1 from public.practice_areas a where a.code = target_area) then
    raise exception 'no such practice area';
  end if;

  update public.practice_area_signatories
  set is_head = false
  where practice_area = target_area and is_head;

  if new_head is not null then
    insert into public.practice_area_signatories (practice_area, lawyer_id, is_head, appointed_by)
    values (target_area, new_head, true, auth.uid ())
    on conflict (practice_area, lawyer_id)
    do update set is_head = true, appointed_by = auth.uid ();
  end if;
end;
$$;

revoke all on function public.set_area_head (text, uuid) from public, anon;
grant execute on function public.set_area_head (text, uuid) to authenticated;

-- Audit ---------------------------------------------------------------------------
--
-- Restated from `20260917120000_user_roles_and_token_hook.sql`, the most recent
-- restatement, plus one mapping. The entity is the lawyer, as for `user_roles`:
-- "who may this person sign for, and since when" is the cut the team screen asks.

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

create trigger practice_area_signatories_audit
after insert or update or delete on public.practice_area_signatories
for each row execute function public.audit_change ();

-- Access ---------------------------------------------------------------------------

alter table public.practice_area_signatories enable row level security;

grant select, insert, update, delete on table public.practice_area_signatories to authenticated;

create policy "practice_area_signatories_select_staff" on public.practice_area_signatories
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "practice_area_signatories_write_admin" on public.practice_area_signatories
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

-- The head appoints and removes reviewers in their own area, and may not hand
-- over headship — `is_head` stays an admin decision, as `is_primary` does.
create policy "practice_area_signatories_reviewers_by_head" on public.practice_area_signatories
  for all to authenticated
  using (
    public.jwt_role () = 'lawyer'
    and not is_head
    and public.is_head_of (practice_area)
  )
  with check (
    public.jwt_role () = 'lawyer'
    and not is_head
    and public.is_head_of (practice_area)
  );

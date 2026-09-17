-- Staff hold a set of roles; the token carries one. Phase 1 of ADR-0026.
--
-- Until now a role was one word in `auth.users.raw_app_meta_data`, written by
-- `approve_user` and read back by every policy through `jwt_role()`. ADR-0026
-- keeps the second half of that exactly as it is — the JWT still carries
-- `app_metadata.role`, one value, the role the caller is acting in — and moves
-- the first half out of the jsonb and into a table:
--
--   * `user_roles`, one row per person per role, is the authority. A table has
--     foreign keys and RLS, and it can carry an entity mapping in
--     `audit_change()` — which is the row ADR-0018 named as missing and left
--     missing: "who made this person a lawyer, and when". It exists from this
--     migration on.
--   * A custom access token hook reads the table when a token is minted and
--     stamps the role into the claim. It runs on every refresh, so a change to
--     the table reaches the token without a forced sign-out. The hook is
--     declared in `supabase/config.toml`, so the local stack, the SQL job in CI
--     and the cloud all mint the same token.
--   * `approve_user` writes `user_roles` instead of the jsonb. The refusals
--     ADR-0018 gave it are unchanged; only the column they consult moved.
--
-- Phase 1 is the shape with nothing observable changed: everyone holds exactly
-- one role, and a constraint says so rather than a comment, because the hook
-- below has no `active_role` to consult yet and "the one row" has to be a fact
-- it can rely on. Phase 2 drops that constraint, adds the active role and the
-- claim listing what the person could switch to, and moves `orders.sql`'s "a
-- reviewer is a lawyer" onto the held set. Nothing here has to be revisited
-- for that. (The switchable set is named nowhere in this file on purpose:
-- `pnpm check:sql` refuses a migration that mentions it outside the hook.)
--
-- `raw_app_meta_data.role` stops being written and is removed from every user
-- that carries it. Not out of tidiness: a value nothing writes and something
-- might still read is the drift ADR-0018 had to write a repair path for, and
-- the day ADM-33 changes a role in `user_roles` the jsonb copy would describe a
-- person who no longer exists. The hook overrides the claim from the table
-- regardless, so the copy protected nothing; what it could do is mislead the
-- next reader of `auth.users`. One consequence for the console: the role is now
-- read from the access token's claims and not from `session.user.app_metadata`,
-- which GoTrue builds from the jsonb — see `apps/console/src/app/claims.ts`.
--
-- Deploying this to the cloud is two steps and the order matters: `db push`
-- first, then `supabase config push` to enable the hook. Between them a
-- freshly minted token carries no role and the console shows the pending
-- screen; existing tokens keep working until they refresh. The other order
-- fails louder — a hook pointing at a function that does not exist yet is a
-- sign-in error for everyone — and neither order needs a user to sign out.

-- The held set --------------------------------------------------------------

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role),
  constraint user_roles_role_known check (role in ('admin', 'lawyer')),
  -- Phase 1: exactly one held role per person, so the hook needs no notion of
  -- an active role to pick the claim. Phase 2 drops this constraint on the day
  -- it adds `active_role`; a person holding two roles before that day would be
  -- a person whose token the hook could not mint honestly.
  constraint user_roles_one_per_user unique (user_id)
);

comment on table public.user_roles is
  'The roles a member of staff holds (ADR-0026). The token carries one of them; jwt_role() reads the token. Who granted a row and when is audit_events.';

comment on constraint user_roles_one_per_user on public.user_roles is
  'Phase 1 of ADR-0026: one held role per person. Dropped by phase 2 together with the arrival of active_role.';

alter table public.user_roles enable row level security;

-- Readers. A member sees their own rows; an admin sees everyone's, because the
-- team screen is theirs. No write grant to `authenticated` at all: a row is
-- written by `approve_user` below (security definer) and, later, by ADM-33's
-- RPC — never by a client statement.
grant select on table public.user_roles to authenticated;

create policy "user_roles_select_own" on public.user_roles
  for select to authenticated
  using (auth.uid () = user_id);

create policy "user_roles_select_admin" on public.user_roles
  for select to authenticated
  using (public.jwt_role () = 'admin');

-- The auth server reads the table when it mints a token. It runs the hook as
-- `supabase_auth_admin`, which bypasses nothing: it needs the grant and, with
-- RLS on, a policy of its own.
grant usage on schema public to supabase_auth_admin;
grant select on table public.user_roles to supabase_auth_admin;

create policy "user_roles_select_auth_admin" on public.user_roles
  for select to supabase_auth_admin
  using (true);

-- Everyone who holds a role today holds it here from now on. The audit trigger
-- is created *after* this insert on purpose: a backfilled row has no actor, and
-- a log row saying "nobody granted this" would be an answer to a question the
-- log was not asked. For these users the answer to "who made them a lawyer" is
-- "before the log existed", and that is what an absent row says.
insert into public.user_roles (user_id, role)
select u.id, u.raw_app_meta_data ->> 'role'
from auth.users u
where u.raw_app_meta_data ->> 'role' in ('admin', 'lawyer');

update auth.users
set raw_app_meta_data = raw_app_meta_data - 'role'
where raw_app_meta_data ? 'role';

-- The token hook ------------------------------------------------------------
--
-- Called by GoTrue with `{"user_id": ..., "claims": {...}, ...}` before every
-- access token is issued, and expected to hand the event back with the claims
-- it wants minted. It sets `claims.app_metadata.role` from the table and
-- removes the key when the person holds nothing — so a value that somehow
-- survived in the jsonb can never reach a token.
--
-- `stable` and not `security definer`: it runs as `supabase_auth_admin`, which
-- has exactly the read it needs and nothing else.

create or replace function public.custom_access_token_hook (event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_role text;
  v_claims jsonb;
begin
  select r.role into v_role
  from public.user_roles r
  where r.user_id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  if v_role is null then
    v_claims := v_claims #- '{app_metadata,role}';
  else
    v_claims := jsonb_set(
      v_claims,
      '{app_metadata}',
      coalesce(v_claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object('role', v_role)
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

comment on function public.custom_access_token_hook (jsonb) is
  'Supabase custom access token hook (ADR-0026). Stamps app_metadata.role from user_roles into every token; declared in config.toml.';

revoke all on function public.custom_access_token_hook (jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook (jsonb) to supabase_auth_admin;

-- approve_user ----------------------------------------------------------------
--
-- Same contract as 20260814120000 (ADR-0018): grants a first role, refuses to
-- change one, is silent about a repeat, raises for a user who does not exist,
-- and repairs a profile that claims a role the authority does not know. The
-- authority is now `user_roles`.

create or replace function public.approve_user (target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if coalesce(public.jwt_role (), '') <> 'admin' then
    raise exception 'only admins can approve users';
  end if;
  if new_role not in ('admin', 'lawyer') then
    raise exception 'invalid role: %', new_role;
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user) then
    raise exception 'no such user: %', target_user;
  end if;

  select r.role into v_current
  from public.user_roles r
  where r.user_id = target_user;

  if v_current is not null then
    if v_current = new_role then
      -- Already done. Saying so with an exception would make the one error this
      -- screen ever shows the one that never means anything.
      return;
    end if;

    raise exception
      'user % already holds role %; approve_user grants a first role and does not change one (ADM-33)',
      target_user, v_current;
  end if;

  insert into public.user_roles (user_id, role) values (target_user, new_role);

  update public.profiles set role = new_role where id = target_user;
end;
$$;

comment on function public.approve_user (uuid, text) is
  'Grants a first role to a user who has none, as a user_roles row. Refuses a user who already holds one — changing a role is ADM-33 and does not exist yet.';

-- Audit -----------------------------------------------------------------------
--
-- The row ADR-0018 left missing. `audit_change` raises for a table it has no
-- mapping for, so this restatement is the mapping being added; it is copied
-- from 20260830130000, the most recent restatement, and `pnpm check:sql` holds
-- that nothing was dropped on the way.

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

create trigger user_roles_audit
after insert or update or delete on public.user_roles
for each row execute function public.audit_change ();

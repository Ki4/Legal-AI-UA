-- approve_user grants a first role. It does not change one.
--
-- The function shipped in 20260730120000_auth_profiles.sql writes the role into
-- auth.users.app_metadata for whatever user id it is handed, without looking at
-- what that user already holds. So it has always been two operations wearing one
-- name: approving a registration, and changing somebody's role. The second is
-- ADM-33, it has no screen, no audit trail and no decision behind it, and it was
-- reachable by any admin through the RPC the approval screen already calls.
--
-- Three consequences, none of them theoretical:
--
--   1. The approval screen lists pending registrations. A stale list — approved
--      in another tab, approved by another admin a minute ago — turns a click on
--      "approve as lawyer" into a demotion of a colleague who is already an
--      admin. Nothing distinguishes the two cases in the request.
--   2. There is no floor under the number of admins. An admin could set the last
--      admin (including themselves) to lawyer, and recovery is the SQL editor
--      and the bootstrap block at the top of the original migration.
--   3. Approving a user id that does not exist reported success. `update ...
--      where id = <nobody>` matches no rows and raises nothing, so the console
--      would say the person had been approved.
--
-- The fix is to make the name true rather than to add a confirmation. A user who
-- already holds a role is refused, and the message says which operation the
-- caller wanted and that it does not exist yet. Re-approving with the role the
-- user already has stays silent and does nothing: a double-click is not an
-- attempt to change anything, and turning it into an error would teach admins
-- that the error means nothing.
--
-- The authority is auth.users.raw_app_meta_data, never profiles.role — the
-- original migration says the profile is a display mirror, and a check that read
-- the mirror could be defeated by drift between them. Drift in the other
-- direction is repaired rather than refused: a profile carrying a role the JWT
-- does not have is a user who cannot actually do anything, and approving them is
-- how that gets fixed.
--
-- Deliberately NOT in this migration, and recorded so they are a list rather
-- than a feeling:
--
--   * The role-change operation itself (ADM-33). It needs a name, a screen, a
--     rule about the last admin and an audit row — that is a decision, not a
--     line of SQL, and inventing it inside a bug fix is how it would arrive
--     without any of them.
--   * An audit trigger on profiles. A role grant is exactly what ADR-0010's log
--     is for, but public.profiles has no entity mapping in audit_change() and
--     adding one also starts logging every registration. That is its own PR.

create or replace function public.approve_user (target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'only admins can approve users';
  end if;
  if new_role not in ('admin', 'lawyer') then
    raise exception 'invalid role: %', new_role;
  end if;

  -- The authority, not the mirror. `->>` returns NULL for a missing key and for
  -- a JSON null alike, which are the same thing here: no role.
  select u.raw_app_meta_data ->> 'role' into v_current
  from auth.users u
  where u.id = target_user;

  if not found then
    raise exception 'no such user: %', target_user;
  end if;

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

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new_role)
  where id = target_user;

  update public.profiles set role = new_role where id = target_user;
end;
$$;

comment on function public.approve_user (uuid, text) is
  'Grants a first role to a user who has none. Refuses a user who already holds one — changing a role is ADM-33 and does not exist yet.';

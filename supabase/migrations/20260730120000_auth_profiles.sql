-- Auth bootstrap: profiles, registration trigger, and admin approval flow.
--
-- Model: anyone can self-register in the console; a new user has NO role and
-- sees a "pending approval" screen. An admin approves them via the
-- approve_user() RPC, which writes the role into auth.users.app_metadata —
-- the only place access control trusts. profiles.role is a display mirror.
--
-- Bootstrapping the first admin (run ONCE in the SQL editor, then never again):
--   update auth.users
--     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--     where email = 'YOUR_EMAIL';
--   update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
-- The user must sign out and back in afterwards: the role lives in the JWT.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. role is a display mirror; enforcement uses JWT app_metadata.';

alter table public.profiles enable row level security;

-- "Automatically expose new tables" is disabled project-wide, so grants are explicit.
grant select on table public.profiles to authenticated;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid () = id);

create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using ((auth.jwt () -> 'app_metadata' ->> 'role') = 'admin');

-- No insert/update/delete policies: clients never write profiles directly.
-- Writes happen only through the security definer functions below.

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user ();

create or replace function public.approve_user (target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'only admins can approve users';
  end if;
  if new_role not in ('admin', 'lawyer') then
    raise exception 'invalid role: %', new_role;
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new_role)
  where id = target_user;

  update public.profiles set role = new_role where id = target_user;
end;
$$;

revoke all on function public.approve_user (uuid, text) from public, anon;
grant execute on function public.approve_user (uuid, text) to authenticated;

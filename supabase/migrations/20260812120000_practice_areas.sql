-- Practice areas: the axis the catalogue never had (ADR-0015, spec §5.6).
--
-- A service sits in exactly one branch of law. That single fact is what lets the
-- catalogue be narrowed to something a lawyer can read, and what will let the
-- assignment picker stop offering every approved lawyer in the firm regardless
-- of what the service is about.
--
-- Three shape decisions, each of which had a plausible alternative:
--
--   1. A table, not an enum. Adding `maritime` the day this firm takes its first
--      shipping matter has to be an insert. An enum makes it a migration and a
--      deploy, which means it will not happen and the service will be filed
--      under something wrong instead.
--   2. Keyed by its code. Fifteen immutable rows have no use for a surrogate id,
--      and the key being the code is what makes `?area=family` a readable filter
--      and this file a readable seed. The code cannot be updated — a code that
--      once meant something has to keep meaning it, because services and audit
--      rows refer to it.
--   3. On `services`, not on `service_versions`. The area is what a service *is*.
--      A service that changes area is a different service, so none of the ADR-0009
--      freezing rules have anything to say about this column.
--
-- No audit trigger on `practice_areas` itself: `audit_change` records what
-- happens to a service, keyed by service, and a reference table has no service.
-- What matters — a service moving from one area to another — is already covered,
-- because the trigger on `services` records changed columns and this is now one
-- of them.

create table public.practice_areas (
  code text primary key,
  label_uk text not null,
  label_en text not null,
  position integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint practice_areas_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

comment on table public.practice_areas is
  'Branches of law a service can sit in. Reference data: added and retired by an admin, never by a migration.';

comment on column public.practice_areas.position is
  'Display order. Deliberately not unique — reordering must not fail on a transient collision. Read it as "order by position, code".';

comment on column public.practice_areas.is_active is
  'A retired area. Services already filed under it keep resolving; it stops being offered for new ones.';

-- The seed list of ADR-0015. Criminal law is deliberately absent: a document in
-- a criminal matter is not a genre generated from a template.
insert into public.practice_areas (code, label_uk, label_en, position) values
  ('family',         'Сімейне право',                 'Family',                    10),
  ('inheritance',    'Спадкове право',                'Inheritance',               20),
  ('civil',          'Цивільне та договірне право',   'Civil and contract',        30),
  ('property',       'Земельне право та нерухомість', 'Land and real estate',      40),
  ('labour',         'Трудове право',                 'Labour',                    50),
  ('business',       'Господарське та корпоративне',  'Business and corporate',    60),
  ('tax',            'Податкове право',               'Tax',                       70),
  ('administrative', 'Адміністративне право',         'Administrative',            80),
  ('enforcement',    'Виконавче провадження',         'Enforcement of decisions',  90),
  ('consumer',       'Захист прав споживачів',        'Consumer protection',      100),
  ('migration',      'Міграційне право',              'Migration',                110),
  ('military',       'Військове та мобілізаційне',    'Military and mobilisation',120),
  ('social',         'Соціальні виплати та пільги',   'Social benefits',          130),
  ('insolvency',     'Банкрутство',                   'Bankruptcy and insolvency',140),
  ('ip',             'Інтелектуальна власність',      'Intellectual property',    150);

-- The code is the identity ------------------------------------------------------
--
-- `on update restrict` on the foreign key would only stop a code change that has
-- services behind it. This stops all of them: an area with nothing attached today
-- may have audit rows referring to it, and "nobody is using it yet" is a state
-- that lasts until someone uses it.

create or replace function public.practice_areas_guard_code ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'a practice area code is permanent; retire the area and add a new one';
  end if;
  return new;
end;
$$;

create trigger practice_areas_code_immutable
before update on public.practice_areas
for each row execute function public.practice_areas_guard_code ();

-- Services gain their area ------------------------------------------------------

alter table public.services
  add column practice_area text references public.practice_areas (code)
    on update restrict on delete restrict;

-- Existing rows predate the column. `civil` is the general-purpose branch and the
-- honest default for "nobody has said yet" — wrong for some of them, visible in
-- the catalogue the moment anyone filters, and correctable by a human in one
-- click. Leaving the column nullable to avoid choosing would be worse: an
-- optional axis is one that half the catalogue is missing, which is the same as
-- not having it.
update public.services set practice_area = 'civil' where practice_area is null;

alter table public.services alter column practice_area set not null;

comment on column public.services.practice_area is
  'The branch of law this service belongs to (ADR-0015). Required: an axis half the catalogue lacks is not an axis.';

create index services_by_practice_area on public.services (practice_area);

-- Who may change what -----------------------------------------------------------
--
-- The area is a catalogue decision, like the slug: an admin decides what is on
-- sale and how it is filed, the assigned lawyer owns the draft's content (§13).
-- This extends the existing guard rather than adding a second one, so there stays
-- one place that answers "what may a lawyer not touch on a service".

create or replace function public.services_guard_catalogue_columns ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Guard on the lawyer role explicitly rather than on "not admin": outside a
  -- request there is no JWT at all, and a migration or a seed running as
  -- postgres must not be caught by this.
  if public.jwt_role () = 'lawyer' and new.slug is distinct from old.slug then
    raise exception 'the slug is a catalogue decision; ask an admin to change it';
  end if;

  if public.jwt_role () = 'lawyer' and new.practice_area is distinct from old.practice_area then
    raise exception 'the practice area is a catalogue decision; ask an admin to change it';
  end if;

  return new;
end;
$$;

-- Access ------------------------------------------------------------------------
--
-- Reference data every screen renders, and nothing in it is confidential — but a
-- pending registration is not staff and has no catalogue to browse, so the read
-- keys on holding a role rather than on merely being signed in.

alter table public.practice_areas enable row level security;

grant select, insert, update, delete on table public.practice_areas to authenticated;

create policy "practice_areas_select_staff" on public.practice_areas
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "practice_areas_write_admin" on public.practice_areas
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

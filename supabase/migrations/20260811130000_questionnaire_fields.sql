-- The questionnaire field dictionary: what a service asks a client, and what
-- the platform is allowed to do with each answer.
--
-- Canonical and per service (ADR-0008). Blocks reference field keys, so an
-- extraction that invents a field must add it here rather than point at
-- something that does not exist. The dictionary is deliberately NOT versioned
-- with the template: a key is an identifier, and identifiers that change
-- meaning are how frozen templates start lying.
--
-- The GDPR questions in docs/CONTRIBUTING.md used to be answered once, in a PR
-- description. Because the questionnaire is data rather than schema, they move
-- onto the row: is this personal data, on what basis, for how long. ADR-0008
-- asks that a field claiming to be personal data without the other two be
-- rejected by a constraint rather than by review, which is what
-- questionnaire_fields_gdpr_triad does.
--
-- The Art. 9 marker comes from ADR-0013. Intake is conversational, and a
-- client describing a divorce or a dismissal will volunteer health,
-- religion or criminal matters. Those need a lawful basis under Art. 9(2),
-- which is a different statement from an Art. 6(1) basis — one column cannot
-- hold both, so there are two.

create type public.questionnaire_field_type as enum (
  'text',
  'long_text',
  'number',
  'date',
  'boolean',
  'select',
  'multi_select'
);

-- GDPR Art. 6(1)(a)-(f). Named rather than lettered: 'contract' survives
-- someone reading it in two years, '(b)' does not.
create type public.personal_data_basis as enum (
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_task',
  'legitimate_interests'
);

-- GDPR Art. 9(2)(a)-(j). For this platform 'legal_claims' — the establishment,
-- exercise or defence of legal claims — is the one that will carry most of the
-- weight, but the others are here so a field cannot be forced into a basis
-- that does not fit it.
create type public.special_category_basis as enum (
  'explicit_consent',
  'employment_social_security',
  'vital_interests',
  'not_for_profit_body',
  'made_public_by_subject',
  'legal_claims',
  'substantial_public_interest',
  'health_care',
  'public_health',
  'archiving_research'
);

create table public.questionnaire_fields (
  id uuid primary key default gen_random_uuid (),
  service_id uuid not null references public.services (id) on delete cascade,
  key text not null,
  label text not null,
  help_text text,
  field_type public.questionnaire_field_type not null,
  required boolean not null default false,
  -- Display order. Deliberately not unique: reordering a list under a unique
  -- constraint needs deferred checks or a shuffle through negative numbers,
  -- and a duplicate position is a cosmetic problem, not a correctness one.
  position integer not null default 0,
  -- Choices for select / multi_select, absent for everything else.
  options jsonb,

  is_personal_data boolean not null default false,
  legal_basis public.personal_data_basis,
  retention_days integer,

  is_special_category boolean not null default false,
  special_category_basis public.special_category_basis,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (service_id, key),

  -- Machine-readable keys: blocks reference these, and a key with a space or a
  -- capital in it will be mistyped by somebody.
  constraint questionnaire_fields_key_shape check (key ~ '^[a-z][a-z0-9_]*$'),

  constraint questionnaire_fields_retention_positive check (
    retention_days is null or retention_days > 0
  ),

  -- ADR-0008: personal data without a basis and a retention period is not a
  -- field, it is a liability. Stated both ways so the flags cannot be left
  -- half-filled in either direction.
  constraint questionnaire_fields_gdpr_triad check (
    (is_personal_data and legal_basis is not null and retention_days is not null)
    or (not is_personal_data and legal_basis is null and retention_days is null)
  ),

  -- Special category is a subset of personal data, never an alternative to it.
  constraint questionnaire_fields_special_category check (
    (is_special_category and is_personal_data and special_category_basis is not null)
    or (not is_special_category and special_category_basis is null)
  ),

  -- Written as CASE rather than as two OR-ed branches on purpose. With
  -- `options` null, `jsonb_typeof(options) = 'array'` is NULL rather than
  -- false, and a CHECK constraint *passes* on NULL — so the natural-looking
  -- version let a select with no options straight through. CASE gives every
  -- row exactly one branch and a true/false answer.
  constraint questionnaire_fields_options check (
    case
      when field_type in ('select', 'multi_select') then
        options is not null
        and jsonb_typeof(options) = 'array'
        and options <> '[]'::jsonb
      else options is null
    end
  )
);

comment on table public.questionnaire_fields is
  'Canonical per-service variable dictionary. Channel-independent: a form input and a chat turn fill the same field (ADR-0013).';

comment on column public.questionnaire_fields.key is
  'Immutable. Blocks and answer snapshots reference it, and a frozen template cannot follow a rename.';

comment on column public.questionnaire_fields.retention_days is
  'Governs the client''s live record, not the frozen snapshot inside a passport — see spec §7.2.';

create index questionnaire_fields_service_position
  on public.questionnaire_fields (service_id, position);

create trigger questionnaire_fields_touch_updated_at
before update on public.questionnaire_fields
for each row execute function public.touch_updated_at ();

-- A key is an identifier, not a label. Published template versions are frozen
-- (ADR-0009) and reference fields by key, so a rename would silently break a
-- template nobody is allowed to edit. The label exists for the renaming urge.
create or replace function public.questionnaire_fields_immutable_key ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.key is distinct from old.key then
    raise exception 'field key % is immutable; change the label instead', old.key;
  end if;
  if new.service_id is distinct from old.service_id then
    raise exception 'a field cannot move between services';
  end if;
  return new;
end;
$$;

create trigger questionnaire_fields_immutable_key
before update on public.questionnaire_fields
for each row execute function public.questionnaire_fields_immutable_key ();

alter table public.questionnaire_fields enable row level security;

grant select, insert, update, delete on table public.questionnaire_fields to authenticated;

create policy "questionnaire_fields_select_staff" on public.questionnaire_fields
  for select to authenticated
  using (public.jwt_role () in ('admin', 'lawyer'));

create policy "questionnaire_fields_write_admin" on public.questionnaire_fields
  for all to authenticated
  using (public.jwt_role () = 'admin')
  with check (public.jwt_role () = 'admin');

-- The dictionary is the lawyer's instrument: §4.4's user stories are all
-- theirs, and deciding whether an answer is personal data and on what basis is
-- a legal judgement, not a catalogue one.
create policy "questionnaire_fields_write_assigned_lawyer" on public.questionnaire_fields
  for all to authenticated
  using (
    public.jwt_role () = 'lawyer'
    and exists (
      select 1 from public.services s
      where s.id = service_id and s.assigned_lawyer_id = auth.uid ()
    )
  )
  with check (
    public.jwt_role () = 'lawyer'
    and exists (
      select 1 from public.services s
      where s.id = service_id and s.assigned_lawyer_id = auth.uid ()
    )
  );

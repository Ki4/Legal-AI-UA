-- Two ways to reach a state ADR-0009 forbids, found by probing the catalogue
-- schema rather than by reading it.
--
-- The root cause is one thing said twice. "Live" is defined by `status`, and
-- "frozen" is defined by `published_at`, and nothing tied the two together. As
-- long as they can disagree, ADR-0009's promise — one version live at a time,
-- the live one not editable — is only true of the paths we happened to test.
--
--   A. Insert a version directly with status = 'paused'. It takes the live slot
--      through the partial unique index, but published_at is still null, so the
--      freeze trigger waves every later edit through. A version that clients
--      would be served, editable in place, which is the exact operation the ADR
--      says must not exist.
--
--   B. Update a published version back to status = 'draft'. The freeze trigger
--      guards content columns and treats status as lifecycle, so it allows the
--      move. The live slot empties, the service has no live version while a
--      published one exists, and the row is left claiming to be a draft with a
--      publication stamp on it.
--
-- Neither is reachable by a lawyer — their policy requires published_at to be
-- null and fences status to the pre-publication values. Both are reachable by
-- an admin, and by anything holding service_role, which is precisely the actor
-- ADR-0009 says triggers exist to constrain.

-- A: occupying the live slot requires having been published. Archiving is
-- deliberately still allowed without publication — a draft that was abandoned
-- should be archivable rather than only deletable, and an archived draft holds
-- no live slot.
alter table public.service_versions
  add constraint service_versions_live_requires_publication check (
    status not in ('published', 'paused') or published_at is not null
  );

-- B: publication is a one-way door. Status may move among the post-publication
-- values — that is how pause, archive and reinstatement work — but it cannot
-- walk back to a pre-publication one.
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
    or new.published_by is distinct from old.published_by then
    raise exception 'service version % is published; its content is frozen (ADR-0009)', old.id;
  end if;

  return new;
end;
$$;

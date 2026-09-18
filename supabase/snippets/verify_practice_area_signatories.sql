-- Verification scenarios for 20260918120000_practice_area_signatories.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_practice_area_signatories.sql
--
-- What is claimed and tried here: publication is three acts (ADR-0027). The
-- author writes, a signatory of the area releases, an admin sells — and none of
-- the three can do another's part, forge a signature, or sell without one.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'author@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'head@test.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'reviewer@test.local'),
  ('00000000-0000-0000-0000-0000000000d4', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000d5', 'solo@test.local'),
  ('00000000-0000-0000-0000-0000000000d6', 'other@test.local');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'lawyer'),
  ('00000000-0000-0000-0000-0000000000d2', 'lawyer'),
  ('00000000-0000-0000-0000-0000000000d3', 'lawyer'),
  ('00000000-0000-0000-0000-0000000000d4', 'admin'),
  ('00000000-0000-0000-0000-0000000000d5', 'lawyer'),
  ('00000000-0000-0000-0000-0000000000d6', 'lawyer');

update public.profiles set role = 'lawyer', full_name = 'The Author'
where id = '00000000-0000-0000-0000-0000000000d1';
update public.profiles set role = 'lawyer', full_name = 'Head of Inheritance'
where id = '00000000-0000-0000-0000-0000000000d2';
update public.profiles set role = 'lawyer', full_name = 'Inheritance Reviewer'
where id = '00000000-0000-0000-0000-0000000000d3';
update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000000d4';
update public.profiles set role = 'lawyer', full_name = 'Solo Head of Labour'
where id = '00000000-0000-0000-0000-0000000000d5';
update public.profiles set role = 'lawyer', full_name = 'Other Lawyer'
where id = '00000000-0000-0000-0000-0000000000d6';

-- Inheritance has a head and a reviewer; labour has one signatory, who is also
-- the author of the one labour service — the founding case.
insert into public.practice_area_signatories (practice_area, lawyer_id, is_head) values
  ('inheritance', '00000000-0000-0000-0000-0000000000d2', true),
  ('inheritance', '00000000-0000-0000-0000-0000000000d3', false),
  ('labour',  '00000000-0000-0000-0000-0000000000d5', true);

insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000000e1', 'divorce', 'Divorce petition', 'inheritance'),
  ('00000000-0000-0000-0000-0000000000e2', 'poa', 'Power of attorney', 'labour');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', true),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d5', true);

insert into public.service_versions
  (id, service_id, version, status, generation_mode, review_mode, created_by) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 1,
   'in_review', 'template', 'auto', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', 1,
   'in_review', 'template', 'auto', '00000000-0000-0000-0000-0000000000d5'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e1', 2,
   'draft', 'template', 'auto', '00000000-0000-0000-0000-0000000000d1');

-- Shape ---------------------------------------------------------------------

do $$
begin
  set local role postgres;

  ------------------------------------------- 1. exactly one head per area
  begin
    insert into public.practice_area_signatories (practice_area, lawyer_id, is_head)
    values ('inheritance', '00000000-0000-0000-0000-0000000000d6', true);
    raise notice 'FAIL 1. a second head was accepted';
  exception when unique_violation then
    raise notice 'PASS 1. an area has one head';
  end;

  ------------------------------------------- 2. a signatory holds the lawyer role
  begin
    insert into public.practice_area_signatories (practice_area, lawyer_id)
    values ('inheritance', '00000000-0000-0000-0000-0000000000d4');
    raise notice 'FAIL 2. an admin was made a signatory';
  exception when others then
    raise notice 'PASS 2. a signatory has to be a lawyer: %', sqlerrm;
  end;

  ------------------------------------------- 3. sale requires a signature
  begin
    update public.service_versions set status = 'published'
    where id = '00000000-0000-0000-0000-0000000000f1';
    raise notice 'FAIL 3. an unreleased version went on sale';
  exception when others then
    raise notice 'PASS 3. nothing goes on sale unsigned: %', sqlerrm;
  end;

  ------------------------------------------- 4. self_released implies released
  begin
    update public.service_versions set self_released = true
    where id = '00000000-0000-0000-0000-0000000000f1';
    raise notice 'FAIL 4. self_released stood without a release';
  exception when check_violation then
    raise notice 'PASS 4. self_released is a kind of release, not a flag on its own';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- The three acts ---------------------------------------------------------------

do $$
declare
  v_by uuid;
  v_self boolean;
  v_at timestamptz;
begin
  set local role authenticated;

  ------------------------------------------- 5. the author is not a signatory
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"lawyer"}}';
  begin
    perform public.release_service_version ('00000000-0000-0000-0000-0000000000f1');
    raise notice 'FAIL 5. an assigned lawyer who does not sign for the area released';
  exception when others then
    raise notice 'PASS 5. assignment is not a signature: %', sqlerrm;
  end;

  ------------------------------------------- 6. an admin does not sign
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","app_metadata":{"role":"admin"}}';
  begin
    perform public.release_service_version ('00000000-0000-0000-0000-0000000000f1');
    raise notice 'FAIL 6. an admin released a version';
  exception when others then
    raise notice 'PASS 6. the professional act is not the admin''s: %', sqlerrm;
  end;

  ------------------------------------------- 7. only a version in review
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","app_metadata":{"role":"lawyer"}}';
  begin
    perform public.release_service_version ('00000000-0000-0000-0000-0000000000f3');
    raise notice 'FAIL 7. a draft was released';
  exception when others then
    raise notice 'PASS 7. a draft is not offered for signature: %', sqlerrm;
  end;

  ------------------------------------------- 8. the reviewer signs
  begin
    perform public.release_service_version ('00000000-0000-0000-0000-0000000000f1');
    select released_by, self_released, released_at into v_by, v_self, v_at
    from public.service_versions where id = '00000000-0000-0000-0000-0000000000f1';
    if v_by = '00000000-0000-0000-0000-0000000000d3' and not v_self and v_at is not null then
      raise notice 'PASS 8. a release reviewer of the area signed, and it was not a self-release';
    else
      raise notice 'FAIL 8. released_by=% self=% at=%', v_by, v_self, v_at;
    end if;
  exception when others then
    raise notice 'FAIL 8. the reviewer could not release: %', sqlerrm;
  end;

  ------------------------------------------- 9. a signature is not written twice
  begin
    perform public.release_service_version ('00000000-0000-0000-0000-0000000000f1');
    raise notice 'FAIL 9. a released version was released again';
  exception when others then
    raise notice 'PASS 9. one signature per text';
  end;

  ------------------------------------------- 10. an edit withdraws the signature
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"lawyer"}}';
  update public.service_versions set review_mode = 'lawyer_required'
  where id = '00000000-0000-0000-0000-0000000000f1';
  select released_by into v_by
  from public.service_versions where id = '00000000-0000-0000-0000-0000000000f1';
  if v_by is null then
    raise notice 'PASS 10. the author edited the content and the signature is gone';
  else
    raise notice 'FAIL 10. the signature survived a content edit';
  end if;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Restore the signature out of band for the next block: a seed's path, not a
-- user's, so the guard lets it through.
update public.service_versions
set released_at = now(), released_by = '00000000-0000-0000-0000-0000000000d3'
where id = '00000000-0000-0000-0000-0000000000f1';

do $$
declare
  v_by uuid;
  v_self boolean;
begin
  set local role authenticated;

  ------------------------------------------- 11. a block edit withdraws it too
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"lawyer"}}';
  insert into public.document_blocks (service_version_id, key, title, body, position)
  values ('00000000-0000-0000-0000-0000000000f1', 'intro', 'Intro', 'Rewritten.', 1);
  select released_by into v_by
  from public.service_versions where id = '00000000-0000-0000-0000-0000000000f1';
  if v_by is null then
    raise notice 'PASS 11. a block is the text the signature stood under; changing it withdraws the release';
  else
    raise notice 'FAIL 11. the signature survived a block edit';
  end if;

  ------------------------------------------- 12. the author cannot forge one
  begin
    update public.service_versions
    set released_at = now(), released_by = '00000000-0000-0000-0000-0000000000d1'
    where id = '00000000-0000-0000-0000-0000000000f1';
    raise notice 'FAIL 12. the assigned lawyer wrote a signature through the policy';
  exception when others then
    raise notice 'PASS 12. the lawyer policy reaches the row and the guard refuses the column: %', sqlerrm;
  end;

  ------------------------------------------- 13. nor can an admin
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","app_metadata":{"role":"admin"}}';
  begin
    update public.service_versions
    set released_at = now(), released_by = '00000000-0000-0000-0000-0000000000d3'
    where id = '00000000-0000-0000-0000-0000000000f1';
    raise notice 'FAIL 13. an admin wrote a signature';
  exception when others then
    raise notice 'PASS 13. an admin cannot sign on a lawyer''s behalf: %', sqlerrm;
  end;

  ------------------------------------------- 14. nor insert one ready-signed
  begin
    insert into public.service_versions
      (service_id, version, status, generation_mode, review_mode, released_at, released_by)
    values ('00000000-0000-0000-0000-0000000000e1', 9, 'in_review', 'template', 'auto',
            now(), '00000000-0000-0000-0000-0000000000d3');
    raise notice 'FAIL 14. a version arrived already signed';
  exception when others then
    raise notice 'PASS 14. a new version is unsigned by construction: %', sqlerrm;
  end;

  ------------------------------------------- 15. the head, with a reviewer, may not self-sign
  --
  -- f3 is the author's draft; move it to review as the author, then make the
  -- head its author to try the case.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"lawyer"}}';
  update public.service_versions set status = 'in_review'
  where id = '00000000-0000-0000-0000-0000000000f3';
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.service_versions set created_by = '00000000-0000-0000-0000-0000000000d2'
  where id = '00000000-0000-0000-0000-0000000000f3';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","app_metadata":{"role":"lawyer"}}';
  begin
    perform public.release_service_version ('00000000-0000-0000-0000-0000000000f3');
    raise notice 'FAIL 15. the head signed their own version while a reviewer exists';
  exception when others then
    raise notice 'PASS 15. four eyes, because there are four: %', sqlerrm;
  end;

  ------------------------------------------- 16. the solo head may, and it is flagged
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d5","app_metadata":{"role":"lawyer"}}';
  begin
    perform public.release_service_version ('00000000-0000-0000-0000-0000000000f2');
    select released_by, self_released into v_by, v_self
    from public.service_versions where id = '00000000-0000-0000-0000-0000000000f2';
    if v_by = '00000000-0000-0000-0000-0000000000d5' and v_self then
      raise notice 'PASS 16. the only signatory of an area signs their own work, and the row says so';
    else
      raise notice 'FAIL 16. released_by=% self=%', v_by, v_self;
    end if;
  exception when others then
    raise notice 'FAIL 16. the solo head was refused: %', sqlerrm;
  end;

  ------------------------------------------- 17. the admin sells a released version
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","app_metadata":{"role":"admin"}}';
  begin
    update public.service_versions set status = 'published'
    where id = '00000000-0000-0000-0000-0000000000f2';
    raise notice 'PASS 17. sale follows signature';
  exception when others then
    raise notice 'FAIL 17. a released version could not be sold: %', sqlerrm;
  end;

  ------------------------------------------- 18. and the signature is then frozen
  begin
    update public.service_versions set released_at = now() - interval '1 year'
    where id = '00000000-0000-0000-0000-0000000000f2';
    raise notice 'FAIL 18. a published version''s signature was rewritten';
  exception when others then
    raise notice 'PASS 18. the signature is part of what publication freezes: %', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Who appoints whom -------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  ------------------------------------------- 19. the head appoints in their area
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.practice_area_signatories (practice_area, lawyer_id)
    values ('inheritance', '00000000-0000-0000-0000-0000000000d6');
    raise notice 'PASS 19. the head appoints a reviewer without an admin';
  exception when others then
    raise notice 'FAIL 19. the head could not appoint: %', sqlerrm;
  end;

  ------------------------------------------- 20. not in somebody else's area
  begin
    insert into public.practice_area_signatories (practice_area, lawyer_id)
    values ('labour', '00000000-0000-0000-0000-0000000000d6');
    raise notice 'FAIL 20. the head of inheritance appointed in labour';
  exception when insufficient_privilege then
    raise notice 'PASS 20. an appointment is per area';
  end;

  ------------------------------------------- 21. and not a head
  begin
    insert into public.practice_area_signatories (practice_area, lawyer_id, is_head)
    values ('inheritance', '00000000-0000-0000-0000-0000000000d1', true);
    raise notice 'FAIL 21. a lawyer wrote a head row';
  exception when others then
    raise notice 'PASS 21. headship stays an admin decision';
  end;

  ------------------------------------------- 22. a head cannot resign by delete
  delete from public.practice_area_signatories
  where practice_area = 'inheritance' and lawyer_id = '00000000-0000-0000-0000-0000000000d2';
  get diagnostics n = row_count;
  if n = 0 then
    raise notice 'PASS 22. the head row is not the head''s to remove';
  else
    raise notice 'FAIL 22. the head deleted their own headship';
  end if;

  ------------------------------------------- 23. a reviewer appoints nobody
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.practice_area_signatories (practice_area, lawyer_id)
    values ('inheritance', '00000000-0000-0000-0000-0000000000d1');
    raise notice 'FAIL 23. a reviewer appointed a reviewer';
  exception when insufficient_privilege then
    raise notice 'PASS 23. appointing is the head''s act, not every signatory''s';
  end;

  ------------------------------------------- 24. set_area_head is the admin's
  begin
    perform public.set_area_head ('inheritance', '00000000-0000-0000-0000-0000000000d3');
    raise notice 'FAIL 24. a lawyer changed the head';
  exception when others then
    raise notice 'PASS 24. only an admin moves headship: %', sqlerrm;
  end;

  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","app_metadata":{"role":"admin"}}';
  perform public.set_area_head ('inheritance', '00000000-0000-0000-0000-0000000000d3');
  select count(*) into n from public.practice_area_signatories
  where practice_area = 'inheritance' and is_head;
  if n = 1 and exists (
    select 1 from public.practice_area_signatories
    where practice_area = 'inheritance' and lawyer_id = '00000000-0000-0000-0000-0000000000d3' and is_head
  ) and exists (
    select 1 from public.practice_area_signatories
    where practice_area = 'inheritance' and lawyer_id = '00000000-0000-0000-0000-0000000000d2' and not is_head
  ) then
    raise notice 'PASS 25. the admin moved headship in one act; the old head stays on as a reviewer';
  else
    raise notice 'FAIL 25. headship did not move cleanly';
  end if;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Audit -------------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  ------------------------------------------- 26. appointments are on the record
  select count(*) into n from public.audit_events
  where entity_table = 'practice_area_signatories'
    and entity_id = '00000000-0000-0000-0000-0000000000d6';
  if n >= 1 then
    raise notice 'PASS 26. an appointment writes an audit row keyed on the lawyer';
  else
    raise notice 'FAIL 26. no audit row for the appointment';
  end if;

  ------------------------------------------- 27. and so is the self-release
  select count(*) into n from public.audit_events
  where entity_table = 'service_versions'
    and entity_id = '00000000-0000-0000-0000-0000000000f2'
    and (after ->> 'self_released')::boolean
    and 'self_released' = any (changed_columns);
  if n >= 1 then
    raise notice 'PASS 27. self_released is in the audit row, as a column anyone can count';
  else
    raise notice 'FAIL 27. the self-release left no countable trace';
  end if;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

rollback;

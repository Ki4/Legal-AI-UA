-- Demo data for local development. Applied by `supabase db reset` after migrations.
-- Rules: invented data only — never real client names, emails, or case details.
-- Auth users are not seeded here: register through the app against the local stack,
-- then promote a first admin with the snippet from the auth migration's header.

-- Catalogue demo data (ADM-7). Deliberately uneven, because the list has to
-- render three different states: a service with an archived predecessor so the
-- live version is not simply "the only one", a paused one, and one that has
-- never been published and has no price.
--
-- Two auth users are seeded after all, contrary to the note above: publishing a
-- version requires an assigned lawyer, so a catalogue with no lawyers cannot
-- demonstrate a published service. Nobody logs in as these — they have no
-- password. Register through the app for a usable account.

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'olena@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'taras@example.test')
on conflict do nothing;

update public.profiles set full_name = 'Olena Kovalchuk', role = 'lawyer'
where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Taras Bondarenko', role = 'lawyer'
where id = '10000000-0000-0000-0000-000000000002';

insert into public.services (id, slug, title, summary, assigned_lawyer_id) values
  ('20000000-0000-0000-0000-000000000001', 'divorce-application', 'Divorce application',
   'Application to dissolve a marriage, filed with a district court.',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'alimony-claim', 'Alimony claim',
   'Claim for child maintenance.', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003', 'power-of-attorney', 'Power of attorney',
   'General power of attorney, no legal consequences for the grantor.', null);

insert into public.service_versions
  (id, service_id, version, generation_mode, review_mode) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1,
   'full_generation', 'lawyer_required'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2,
   'full_generation', 'lawyer_required'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 1,
   'block_assembly', 'lawyer_required');

insert into public.service_version_prices values
  ('30000000-0000-0000-0000-000000000001', 'UAH', 480000),
  ('30000000-0000-0000-0000-000000000002', 'UAH', 520000);

-- Publishing v1 then v2 archives v1, which is the state we want on screen.
update public.service_versions set status = 'published'
where id = '30000000-0000-0000-0000-000000000001';
update public.service_versions set status = 'published'
where id = '30000000-0000-0000-0000-000000000002';

-- svc-alimony keeps its draft, unpriced. svc-poa has no versions at all.

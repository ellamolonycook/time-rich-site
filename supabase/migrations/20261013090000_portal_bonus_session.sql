-- ---------------------------------------------------------------------
-- Portal: the tenth session.
--
-- "Bonus: Multi-LLM & Setting Your Harness" was missing from the seed.
-- The portal already knows what to do with it: portal-sessions.js and
-- curriculum.html both match a leading "Bonus: " and move that word into
-- a pill, so the title has to keep the prefix exactly as written here.
--
-- Wed 28 Oct 2026, 12:00-13:15 America/New_York. It falls between the
-- 26 Oct and 30 Oct sessions, so it is session 2 of 10 by date. Nothing
-- in the portal numbers sessions by hand: every list is ordered by
-- starts_at, so inserting into the middle needs no other change.
--
-- The Zoom link is deliberately NOT written here. Every session shares
-- one recurring link, so this copies it from the earliest session that
-- already has one. That keeps the URL out of the repository and means
-- this row cannot drift from the others.
--
-- Idempotent: matched on starts_at and title, so running it twice adds
-- nothing. Safe to run before or after the base seed.
-- ---------------------------------------------------------------------

insert into public.portal_sessions (week_id, title, starts_at, join_url, addevent_url)
select 1,
       'Bonus: Multi-LLM & Setting Your Harness',
       (timestamp '2026-10-28 12:00') at time zone 'America/New_York',
       (select s.join_url
          from public.portal_sessions s
         where s.join_url is not null
           and btrim(s.join_url) <> ''
         order by s.starts_at
         limit 1),
       'https://www.addevent.com/event/zt2r86vdvnsm'
 where not exists (
   select 1
     from public.portal_sessions existing
    where existing.starts_at = (timestamp '2026-10-28 12:00') at time zone 'America/New_York'
      and existing.title = 'Bonus: Multi-LLM & Setting Your Harness'
 );

-- If this ran before any session had a join_url, the row is in but the
-- link is empty. Fill it from a sibling the next time the migration runs
-- rather than leaving a session nobody can join.
update public.portal_sessions
   set join_url = (select s.join_url
                     from public.portal_sessions s
                    where s.join_url is not null
                      and btrim(s.join_url) <> ''
                    order by s.starts_at
                    limit 1)
 where title = 'Bonus: Multi-LLM & Setting Your Harness'
   and (join_url is null or btrim(join_url) = '');

-- Check after running:
--   select title, starts_at, addevent_url is not null as has_cal,
--          join_url is not null as has_zoom
--     from public.portal_sessions
--    order by starts_at;
--   -- expect 10 rows, the bonus second by date.

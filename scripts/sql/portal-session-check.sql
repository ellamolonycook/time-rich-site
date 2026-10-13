-- Read-only. Changes nothing; safe to run on production.
--
-- One row per session, in date order, answering three questions:
--   does every session share the one recurring Zoom link?
--   is the Add to Calendar link set?
--   are all ten sessions there, with the bonus second by date?
--
-- zoom_matches_common is false for any session whose join_url differs from
-- the link most sessions use, and null when the session has no link at all.

with link_counts as (
  select join_url, count(*) as n
    from public.portal_sessions
   where join_url is not null
     and btrim(join_url) <> ''
   group by join_url
),
common as (
  select join_url
    from link_counts
   order by n desc, join_url
   limit 1
)
select row_number() over (order by s.starts_at)            as seq,
       s.title,
       s.week_id,
       s.starts_at at time zone 'America/New_York'         as starts_at_new_york,
       case
         when s.join_url is null or btrim(s.join_url) = '' then null
         else s.join_url = (select join_url from common)
       end                                                 as zoom_matches_common,
       (s.join_url is not null and btrim(s.join_url) <> '')     as has_zoom,
       (s.addevent_url is not null and btrim(s.addevent_url) <> '') as has_addevent,
       s.addevent_url
  from public.portal_sessions s
 order by s.starts_at;

-- Expected after the bonus migration: 10 rows, seq 2 is
-- "Bonus: Multi-LLM & Setting Your Harness", zoom_matches_common true
-- everywhere, has_addevent true everywhere.

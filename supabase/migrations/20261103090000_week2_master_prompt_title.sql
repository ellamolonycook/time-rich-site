-- Ella 3 Nov: Week 2 "First 5 minutes of the call" is now "Master Prompt".
-- Renamed in place so the row keeps its id and members keep their ticks.
-- Run this before re-running 20261101090000_week2_time_rich_os.sql, which
-- now matches on the new title. Safe to run more than once.
update public.portal_items
   set title = $tr$Master Prompt$tr$
 where week_id = 2 and title = $tr$First 5 minutes of the call$tr$;

select id, title, sort, published from public.portal_items
 where week_id = 2 and sort = 22;

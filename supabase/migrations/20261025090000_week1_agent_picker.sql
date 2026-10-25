-- =====================================================================
-- Curriculum: Week 1 points at the personal agent table (25 Oct).
--
-- The table "Which personal AI agent should you start with?" lives on
-- Resources (portal/resources.html, #agents-heading). Week 1 gets one link
-- item that opens it there, so the table is kept in one place.
--
-- Content only. One row, matched on week and title: inserted if missing,
-- rewritten in place if it is already there (so a member's tick survives).
-- No other row is touched. Safe to run more than once.
-- =====================================================================

begin;

create temp table want (
  week_id integer, kind text, title text, sort integer, body text, url text
) on commit drop;

insert into want (week_id, kind, title, sort, body, url) values
  (1, $tr$link$tr$, $tr$Pick your personal AI agent$tr$, 80,
   $tr$Dots, Muse, Grok Bot, Instinct and Hark now do real work for you: your inbox, your calendar, your bookings. They overlap a lot, so don't try them all.

Open the table, pick the one that lives where your context already is, give it one recurring task, and keep approval on.$tr$,
   $tr$https://timerich.ai/portal/resources#agents-heading$tr$);

update public.portal_items i
   set kind = w.kind, body = w.body, url = w.url, sort = w.sort, published = true
  from want w
 where i.week_id = w.week_id and i.title = w.title;

insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select w.week_id, w.kind, w.title, w.body, w.url, w.sort, true
  from want w
 where not exists (select 1 from public.portal_items i
                    where i.week_id = w.week_id and i.title = w.title);

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items
   where week_id = 1 and published and title = 'Pick your personal AI agent'
     and url = 'https://timerich.ai/portal/resources#agents-heading';
  if v <> 1 then raise exception 'expected one published agent picker row in Week 1, found %', v; end if;
end
$$;

commit;

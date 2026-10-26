-- Ella 26 Oct 2:23pm: Wispr Flow is Step 1. "Post your intro" moves to
-- after the Business COMPASS (Week 1, Monday), so members get their AI to
-- write their intro from their COMPASS.
--
-- Start here becomes:
--   Step 1 Install Wispr Flow: Install Wispr Flow, Turn it on
--   Step 2 Set up your AI: Paid AI plan, Lock down privacy, Tell your AI
--          how you work, Connect your tools (needs the AI app, so it moves
--          here from the Wispr step)
--   Step 3 Join the Club: TRC Slack, Photo and name
-- Week 1 Monday: ... Build your Business COMPASS (40), Post your intro (42),
-- Build your ICP (44) ...
--
-- Rows keep their ids, so ticks are kept. Safe to run more than once.
begin;

update public.portal_items set sort = 110 where week_id = 0 and title = 'Install Wispr Flow';
update public.portal_items set sort = 120 where week_id = 0 and title = 'Turn it on';
update public.portal_items set sort = 240 where week_id = 0 and title = 'Connect your tools';
update public.portal_items set sort = 310 where week_id = 0 and title = 'TRC Slack';
update public.portal_items set sort = 320 where week_id = 0 and title = 'Photo and name';

update public.portal_items
   set week_id = 1, sort = 42
 where week_id = 0 and title = 'Post your intro'
   and not exists (select 1 from public.portal_items q where q.week_id = 1 and q.title = 'Post your intro');

update public.portal_items
   set body = replace(body,
     $tr$Post it in #introductions. Press Copy, paste it into the message box (Cmd+V on Mac, Ctrl+V on Windows), replace each point with your answer and press send.$tr$,
     $tr$Let your AI write it from your Business COMPASS. Press Copy, open a new chat in your Business Hub, paste the template and say: "Fill this in from my Business COMPASS, in my voice." Check it sounds like you, then post it in #introductions.$tr$)
 where week_id = 1 and title = 'Post your intro';

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items
   where published and week_id = 1 and title = 'Post your intro' and sort = 42
     and body like 'Let your AI write it from your Business COMPASS.%';
  if v <> 1 then raise exception 'Post your intro is not after the COMPASS with the new first line'; end if;

  select count(*) into v from public.portal_items
   where published and week_id = 0 and sort >= 100 and sort < 200
     and title not in ('Install Wispr Flow', 'Turn it on');
  if v <> 0 then raise exception 'Step 1 holds something other than Wispr Flow'; end if;
end $$;
commit;

select week_id, title, sort from public.portal_items
 where published and ((week_id = 0 and sort >= 100) or (week_id = 1 and sort < 50))
 order by week_id, sort;

-- Ella 26 Oct 2:13pm: Monday in this order: North Star, Create your Business
-- Hub, the Hub steps, Business COMPASS, ICP, then Your master prompt last.
-- Only the master prompt moves (sort 5 to 46, still inside Monday, which
-- ends at 49).
--
-- Ella 2:14pm: the shortcut setup prompt now tells the AI to bring the
-- shortcuts screen up on the member's screen, so they can add them in.
--
-- Runs after 20261026171000_week1_master_prompt_steps.sql. Safe to run
-- more than once.
begin;

update public.portal_items
   set sort = 46
 where week_id = 1 and title = 'Your master prompt';

update public.portal_items
   set body = replace(body,
     $tr$First ask me if I'm on a Mac or Windows. Then walk me through it one click at a time, and wait for me to say done before the next step.$tr$,
     $tr$First ask me if I'm on a Mac or Windows. Then bring up the screen where shortcuts are saved on my computer, and I'll add each one in. If you can't open it on my screen yourself, tell me exactly what to click or type to bring it up. Walk me through it one click at a time, and wait for me to say done before the next step.$tr$)
 where week_id = 1 and title = 'Your master prompt';

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items
   where published and week_id = 1 and title = 'Your master prompt' and sort = 46
     and body like $tr$%Then bring up the screen where shortcuts are saved on my computer, and I'll add each one in.%$tr$;
  if v <> 1 then raise exception 'Your master prompt is not last on Monday with the bring-it-up line'; end if;

  select count(*) into v from public.portal_items
   where published and week_id = 1 and sort < 50 and title <> 'Your master prompt' and sort >= 46;
  if v <> 0 then raise exception 'Another Monday row sits after the master prompt'; end if;
end $$;
commit;

select title, sort from public.portal_items
 where published and week_id = 1 and sort < 50
 order by sort;

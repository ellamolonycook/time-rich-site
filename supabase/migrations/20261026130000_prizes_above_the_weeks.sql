-- The Superhuman prizes move out of the 10 Growth Prompts lesson. The
-- curriculum page now draws them above the week tabs, so they show in every
-- week. The lesson keeps its call to post in #audacious-wins and the prompt
-- that writes the post.
--
-- Runs after 20261026090000_week1_flow_order.sql, which put the prizes in the
-- lesson. If that one has not run, the body does not start with the prizes
-- and nothing changes.

update public.portal_items
   set body = substring(body from position('Want to go in the draw?' in body))
 where week_id = 1 and title = '10 Growth Prompts'
   and body like 'Superhuman prizes%'
   and position('Want to go in the draw?' in body) > 0;

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items
   where published and week_id = 1 and title = '10 Growth Prompts'
     and body like '%| Boldest Move |%';
  if v <> 0 then raise exception 'the prizes table is still in the 10 Growth Prompts lesson'; end if;
end $$;

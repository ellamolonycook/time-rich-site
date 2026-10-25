-- =====================================================================
-- Start here: the Slack channels drop-down (25 Oct).
--
-- The drop-down under "Say hello in #introductions" was named "The
-- channels, and who to ask". It now reads "The channels, and where to
-- ask": the list is of channels, so the question it answers is where.
--
-- Only the "+ " line that names the drop-down changes; the channel list
-- under it, the row's id and the member's tick are untouched. Safe to
-- run more than once: a second run finds nothing to change and the
-- check still passes.
-- =====================================================================

begin;

update public.portal_items
   set body = replace(body, '+ The channels, and who to ask', '+ The channels, and where to ask')
 where week_id = 0
   and title = 'Say hello in #introductions'
   and body like '%+ The channels, and who to ask%';

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items
   where week_id = 0 and published and title = 'Say hello in #introductions'
     and body like '%+ The channels, and where to ask%'
     and body not like '%who to ask%';
  if v <> 1 then raise exception 'expected the #introductions row to name its drop-down "The channels, and where to ask", found % such rows', v; end if;
end
$$;

commit;

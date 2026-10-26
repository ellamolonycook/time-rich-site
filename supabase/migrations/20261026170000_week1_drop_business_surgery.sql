-- "Open Business Surgery" comes off the Week 1 list. The row is kept, not
-- deleted, so a member's tick survives if it ever comes back.
--
-- Runs after 20261026090000_week1_flow_order.sql, which publishes the row.
-- Safe to run more than once.

update public.portal_items set published = false
 where week_id = 1 and title in ('Open Business Surgery',
                                 'Monday 26 October: Open Business Surgery');

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items
   where published and week_id = 1 and title like '%Open Business Surgery%';
  if v <> 0 then raise exception 'Open Business Surgery is still on the Week 1 list'; end if;
end $$;

-- Ella 26 Oct 6:14pm: "Stay connected with Ella in the virtual club" at the
-- top of the portal. A pinned Start here link (sort under 100) is drawn as a
-- small button beside the welcome title, next to the calendar button.
-- Safe to run more than once.
insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select 0, 'link', 'Stay connected with Ella in the virtual club', null,
       'https://join.slack.com/t/timerichclub/shared_invite/zt-4dry4ppfn-yV~VNRrHW_z3K3AFtbnOJQ', 25, true
where not exists (select 1 from public.portal_items
                   where week_id = 0 and title = 'Stay connected with Ella in the virtual club');

select title, kind, sort, published, url from public.portal_items
 where published and week_id = 0 and sort < 100 order by sort;

-- Ella 26 Oct 2:57pm: the Loom on Create your Business Hub, shown outside
-- the drop-down. Run AFTER the PR that plays video rows outside is merged.
update public.portal_items
   set kind = 'video', url = 'https://www.loom.com/share/ad2afd7e10df492fbb8fca31558a3439'
 where week_id = 1 and title = 'Create your Business Hub';

select title, kind, url from public.portal_items where week_id = 1 and title = 'Create your Business Hub';

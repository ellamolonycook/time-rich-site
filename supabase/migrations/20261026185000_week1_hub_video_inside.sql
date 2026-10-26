-- Ella 26 Oct 3:13pm: the Loom goes inside Create your Business Hub, so it
-- hides with the row, and the row can be ticked again. Run AFTER the PR
-- that adds "Video:" lines is merged.
update public.portal_items
   set kind = 'link',
       url = 'https://claude.ai/projects',
       body = 'Video: https://www.loom.com/share/ad2afd7e10df492fbb8fca31558a3439' || chr(10) || chr(10) || body
 where week_id = 1 and title = 'Create your Business Hub'
   and body not like 'Video: %';

select title, kind, url, left(body, 80) as body_start from public.portal_items
 where week_id = 1 and title = 'Create your Business Hub';

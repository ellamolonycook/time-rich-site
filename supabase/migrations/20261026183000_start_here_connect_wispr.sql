-- Ella 26 Oct 2:59pm: add "Connect Wispr Flow to your AI" as a step.
-- It needs the AI app, so it sits in Set up your AI, before Connect your tools.
begin;
insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select 0, 'text', 'Connect Wispr Flow to your AI',
  $tr$This lets your AI read what you say into Wispr Flow. In Wispr Flow, open Settings, then MCP, and click Add to Claude.$tr$,
  null, 235, true
where not exists (select 1 from public.portal_items where week_id = 0 and title = 'Connect Wispr Flow to your AI');

update public.portal_items
   set body = replace(body, $tr$In Wispr Flow: Settings, MCP, Add to Claude. Then in Claude: Settings, Connectors$tr$, $tr$In Claude: Settings, Connectors$tr$)
 where week_id = 0 and title = 'Connect your tools';
commit;

select title, sort from public.portal_items
 where published and week_id = 0 and sort >= 100 order by sort;

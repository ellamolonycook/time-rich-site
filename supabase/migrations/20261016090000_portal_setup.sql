-- One-time onboarding belongs to the member profile, across devices.
alter table public.portal_members add column if not exists setup jsonb not null
  default '{"calendar":false,"notion":false}'::jsonb;

create or replace function public.portal_payload(p_member public.portal_members)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $fn$
declare
  v_weeks    jsonb;
  v_sessions jsonb;
  v_progress jsonb;
begin
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id',         w.id,
               'title',      w.title,
               'summary',    w.summary,
               'release_at', w.release_at,
               'unlocked',   (w.release_at <= now()),
               'items',
                 case when w.release_at <= now() then
                   coalesce(
                     (select jsonb_agg(
                               jsonb_build_object(
                                 'id',    i.id,
                                 'kind',  i.kind,
                                 'title', i.title,
                                 'body',  i.body,
                                 'url',   i.url,
                                 'sort',  i.sort
                               )
                               order by i.sort, i.id
                             )
                        from public.portal_items i
                       where i.week_id = w.id
                         and i.published),
                     '[]'::jsonb)
                 else
                   '[]'::jsonb
                 end
             )
             order by w.id
           ),
           '[]'::jsonb)
    into v_weeks
    from public.portal_weeks w;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id',            s.id,
               'title',         s.title,
               'starts_at',     s.starts_at,
               'join_url',      s.join_url,
               'recording_url', s.recording_url,
               'addevent_url',  s.addevent_url,
               'week_id',       s.week_id
             )
             order by s.starts_at, s.id
           ),
           '[]'::jsonb)
    into v_sessions
    from public.portal_sessions s;

  select jsonb_build_object(
           'items', coalesce(jsonb_agg(p.item_id) filter (where p.item_id is not null), '[]'::jsonb),
           'sessions', coalesce(jsonb_agg(p.session_id) filter (where p.session_id is not null), '[]'::jsonb)
         )
    into v_progress
    from public.portal_member_progress p
   where p.member_id = p_member.id;

  return jsonb_build_object(
    'ok', true,
    'member', jsonb_build_object(
      'first_name', nullif(split_part(btrim(coalesce(p_member.full_name, '')), ' ', 1), ''),
      'role',       p_member.role,
      'setup',      p_member.setup
    ),
    'weeks',    v_weeks,
    'sessions', v_sessions,
    'progress', v_progress
  );
end;
$fn$;


create or replace function public.portal_set_setup(p_token text, p_step text, p_done boolean)
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, public
as $fn$
declare v_member_id uuid;
begin
  if p_step is null or p_step not in ('calendar', 'notion') or p_done is null then
    return jsonb_build_object('ok', false);
  end if;
  select s.member_id into v_member_id from public.portal_login_sessions s
    join public.portal_members m on m.id = s.member_id
    where s.token = nullif(btrim(coalesce(p_token, '')), '') and s.expires_at > now() and m.active limit 1;
  if not found then return jsonb_build_object('ok', false); end if;
  update public.portal_members set setup = jsonb_set(setup, array[p_step], to_jsonb(p_done)) where id = v_member_id;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.portal_set_setup(text, text, boolean) from public;
do $fn$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.portal_set_setup(text, text, boolean) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.portal_set_setup(text, text, boolean) to service_role;
  end if;
end $fn$;

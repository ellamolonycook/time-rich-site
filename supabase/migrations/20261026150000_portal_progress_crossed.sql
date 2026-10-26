-- ---------------------------------------------------------------------
-- A lesson can be ticked, or crossed off as not needed. Both are saved to
-- the member's account, so a cross follows them across devices and shows
-- in the data.
--
-- A cross is a done row with crossed = true: it counts as done, the same as
-- a tick, so it never holds a member back.
--
--   select m.full_name, i.title, p.crossed, p.completed_at
--     from portal_member_progress p
--     join portal_members m on m.id = p.member_id
--     join portal_items i on i.id = p.item_id
--    order by m.full_name, i.week_id, i.sort;
--
-- The old four-argument portal_set_progress stays, so a Worker that has
-- not been redeployed keeps saving ticks. The new five-argument one takes
-- p_crossed; it has no default, so a call without it never reaches it.
-- ---------------------------------------------------------------------

alter table public.portal_member_progress
  add column if not exists crossed boolean not null default false;

comment on column public.portal_member_progress.crossed is
  'True when the member crossed the item off as not needed, rather than ticking it.';

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
           'crossed', coalesce(jsonb_agg(p.item_id) filter (where p.item_id is not null and p.crossed), '[]'::jsonb),
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

create or replace function public.portal_set_progress(
  p_token text,
  p_item_id bigint,
  p_session_id bigint,
  p_done boolean,
  p_crossed boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $fn$
declare
  v_member_id uuid;
begin
  -- A cross is for curriculum items only, and only on a done row.
  if p_crossed is null or (p_crossed and (p_item_id is null or not p_done)) then
    return jsonb_build_object('ok', false);
  end if;

  if p_session_id is not null then
    return public.portal_set_progress(p_token, p_item_id, p_session_id, p_done);
  end if;

  if p_item_id is null or p_done is null then
    return jsonb_build_object('ok', false);
  end if;

  select s.member_id into v_member_id
    from public.portal_login_sessions s
    join public.portal_members m on m.id = s.member_id
   where s.token = nullif(btrim(coalesce(p_token, '')), '')
     and s.expires_at > now()
     and m.active
   limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  if not exists (
    select 1
      from public.portal_items i
      join public.portal_weeks w on w.id = i.week_id
     where i.id = p_item_id
       and i.published
       and w.release_at <= now()
  ) then
    return jsonb_build_object('ok', false);
  end if;

  if p_done then
    insert into public.portal_member_progress (member_id, item_id, crossed)
    values (v_member_id, p_item_id, p_crossed)
    on conflict (member_id, item_id) where item_id is not null
    do update set crossed = excluded.crossed;
  else
    delete from public.portal_member_progress
     where member_id = v_member_id and item_id = p_item_id;
  end if;

  return jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'portal_set_progress failed: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', false);
end;
$fn$;

revoke all on function public.portal_set_progress(text, bigint, bigint, boolean, boolean) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.portal_set_progress(text, bigint, bigint, boolean, boolean) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.portal_set_progress(text, bigint, bigint, boolean, boolean) to service_role';
  end if;
end
$$;

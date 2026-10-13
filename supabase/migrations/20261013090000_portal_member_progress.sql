-- ---------------------------------------------------------------------
-- Account-level portal progress.
--
-- Each row is one completed curriculum item or attended session for one
-- member. This intentionally lives beside portal_members rather than in a
-- JSON column on it: content can grow without rewriting a member record and
-- the foreign keys clean up progress when content is removed.
-- ---------------------------------------------------------------------

create table if not exists public.portal_member_progress (
  id           bigint      generated always as identity primary key,
  member_id    uuid        not null references public.portal_members(id) on delete cascade,
  item_id      bigint      references public.portal_items(id) on delete cascade,
  session_id   bigint      references public.portal_sessions(id) on delete cascade,
  completed_at timestamptz not null default now(),
  check (num_nonnulls(item_id, session_id) = 1)
);

create unique index if not exists portal_member_progress_item_idx
  on public.portal_member_progress (member_id, item_id)
  where item_id is not null;

create unique index if not exists portal_member_progress_session_idx
  on public.portal_member_progress (member_id, session_id)
  where session_id is not null;

alter table public.portal_member_progress enable row level security;

comment on table public.portal_member_progress is
  'Completed curriculum items and attended sessions, keyed to the member account.';

revoke all on table public.portal_member_progress from public;

-- Replace the shared payload builder so every portal read carries the
-- member's current ticks. All reads still go through an authenticated
-- session-token RPC; the browser never reads this table directly.
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
      'role',       p_member.role
    ),
    'weeks',    v_weeks,
    'sessions', v_sessions,
    'progress', v_progress
  );
end;
$fn$;

-- Set or clear one tick for the member represented by p_token. Item writes
-- are limited to published content in an unlocked week, matching portal_get.
create or replace function public.portal_set_progress(
  p_token text,
  p_item_id bigint default null,
  p_session_id bigint default null,
  p_done boolean default false
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
  if num_nonnulls(p_item_id, p_session_id) <> 1 or p_done is null then
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

  if p_item_id is not null then
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
      insert into public.portal_member_progress (member_id, item_id)
      values (v_member_id, p_item_id)
      on conflict (member_id, item_id) where item_id is not null do nothing;
    else
      delete from public.portal_member_progress
       where member_id = v_member_id and item_id = p_item_id;
    end if;
  else
    if not exists (select 1 from public.portal_sessions where id = p_session_id) then
      return jsonb_build_object('ok', false);
    end if;

    if p_done then
      insert into public.portal_member_progress (member_id, session_id)
      values (v_member_id, p_session_id)
      on conflict (member_id, session_id) where session_id is not null do nothing;
    else
      delete from public.portal_member_progress
       where member_id = v_member_id and session_id = p_session_id;
    end if;
  end if;

  return jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'portal_set_progress failed: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', false);
end;
$fn$;

revoke all on function public.portal_set_progress(text, bigint, bigint, boolean) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.portal_member_progress from anon';
    execute 'revoke all on function public.portal_set_progress(text, bigint, bigint, boolean) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.portal_member_progress from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.portal_set_progress(text, bigint, bigint, boolean) to service_role';
  end if;
end
$$;

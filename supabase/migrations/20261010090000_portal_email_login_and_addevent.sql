-- ---------------------------------------------------------------------
-- Portal: sign in with an email address, and an Add to Calendar link.
--
-- 1. portal_sessions.addevent_url
--    A nullable link to an Add Event page for one session. When it is
--    empty the portal hides its "Add to calendar" button.
--
-- 2. Email login
--    portal_members.passcode stays exactly as it is. It is simply no
--    longer what signs a member in, so nothing is dropped and the
--    existing portal_get(passcode) keeps working.
--
--    The new path is:
--      portal_login(email)        -> issues a 30 day session token
--      portal_get_by_token(token) -> the same payload portal_get returns
--
--    Both are service_role only. The browser never calls them directly;
--    the Worker does, which is what lets the login be rate limited by IP.
--
--    NOTE ON THE SECURITY TRADE-OFF. An email address is not a secret:
--    it is on LinkedIn, in CC lines, and in this portal's own member
--    directory. Anyone who knows a member's address can now sign in as
--    them. The passcode was a shared secret; this is not. If that matters
--    later, the shape here already supports it: send a one-time link to
--    the address and only mint the token when the link is opened.
-- ---------------------------------------------------------------------

-- ---- 1. the Add Event link -------------------------------------------
alter table public.portal_sessions
  add column if not exists addevent_url text;

comment on column public.portal_sessions.addevent_url is
  'Add Event page for this session. Null or empty hides the portal''s Add to calendar button.';


-- ---- 2. email normalisation ------------------------------------------
-- Trimmed and lowercased, so "  Ella@Example.COM " matches the stored
-- "ella@example.com". Immutable so it can carry a unique index.
create or replace function public.portal_normalize_email(p_email text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $fn$
  select nullif(lower(btrim(coalesce(p_email, ''))), '');
$fn$;

comment on function public.portal_normalize_email(text) is
  'Canonical form of an email: trimmed and lowercased. Null for empty input.';

-- Two members whose addresses differ only in case or padding would make
-- the login ambiguous. This stops that at the table.
create unique index if not exists portal_members_email_norm_idx
  on public.portal_members (public.portal_normalize_email(email))
  where email is not null;


-- ---- 3. session tokens ------------------------------------------------
create table if not exists public.portal_login_sessions (
  token       text        primary key,
  member_id   uuid        not null references public.portal_members(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists portal_login_sessions_member_idx
  on public.portal_login_sessions (member_id);
create index if not exists portal_login_sessions_expires_idx
  on public.portal_login_sessions (expires_at);

alter table public.portal_login_sessions enable row level security;

comment on table public.portal_login_sessions is
  'One row per signed-in browser. Reachable only through portal_login() and portal_get_by_token().';

revoke all on table public.portal_login_sessions from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.portal_login_sessions from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.portal_login_sessions from authenticated';
  end if;
end
$$;


-- ---- 4. the payload, in one place -------------------------------------
-- portal_get, portal_login and portal_get_by_token all answer with the
-- same object. Building it here means the three cannot drift apart.
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

  return jsonb_build_object(
    'ok', true,
    'member', jsonb_build_object(
      'first_name', nullif(split_part(btrim(coalesce(p_member.full_name, '')), ' ', 1), ''),
      'role',       p_member.role
    ),
    'weeks',    v_weeks,
    'sessions', v_sessions
  );
end;
$fn$;

comment on function public.portal_payload(public.portal_members) is
  'The portal payload for one member. Shared by portal_get, portal_login and portal_get_by_token.';


-- ---- 5. portal_get, now using the shared payload ----------------------
-- Unchanged behaviour, except that sessions carry addevent_url. Kept so
-- anything still holding a passcode keeps working.
create or replace function public.portal_get(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $fn$
declare
  v_norm   text;
  v_member public.portal_members%rowtype;
begin
  v_norm := public.portal_normalize_code(p_code);

  if v_norm is null or length(v_norm) = 0 then
    return jsonb_build_object('ok', false);
  end if;

  select m.* into v_member
    from public.portal_members m
   where public.portal_normalize_code(m.passcode) = v_norm
     and m.active
   limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  update public.portal_members
     set last_seen_at = now()
   where id = v_member.id;

  return public.portal_payload(v_member);

exception
  when others then
    raise warning 'portal_get failed: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', false);
end;
$fn$;


-- ---- 6. sign in with an email ----------------------------------------
-- Returns { ok: false } for an unknown address and for an inactive
-- member alike, so the answer says nothing about who exists.
--
-- On success it mints a token, stamps last_seen_at and returns the
-- payload with the token and its expiry alongside.
create or replace function public.portal_login(p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $fn$
declare
  v_norm    text;
  v_member  public.portal_members%rowtype;
  v_token   text;
  v_expires timestamptz;
begin
  v_norm := public.portal_normalize_email(p_email);

  if v_norm is null then
    return jsonb_build_object('ok', false);
  end if;

  select m.* into v_member
    from public.portal_members m
   where public.portal_normalize_email(m.email) = v_norm
     and m.active
   limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  -- 64 hex characters from two UUIDs. gen_random_uuid() is already used by
  -- this schema, so this needs no extension that is not here already.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '30 days';

  insert into public.portal_login_sessions (token, member_id, expires_at)
  values (v_token, v_member.id, v_expires);

  -- Housekeeping, cheap and bounded: drop this member's dead sessions.
  delete from public.portal_login_sessions
   where member_id = v_member.id
     and expires_at <= now();

  update public.portal_members
     set last_seen_at = now()
   where id = v_member.id;

  return public.portal_payload(v_member)
         || jsonb_build_object('token', v_token, 'expires_at', v_expires);

exception
  when others then
    raise warning 'portal_login failed: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', false);
end;
$fn$;

comment on function public.portal_login(text) is
  'Email in, 30 day session token and portal payload out. Service role only.';


-- ---- 7. read the portal with a token ----------------------------------
create or replace function public.portal_get_by_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $fn$
declare
  v_token   text;
  v_member  public.portal_members%rowtype;
begin
  v_token := nullif(btrim(coalesce(p_token, '')), '');

  if v_token is null then
    return jsonb_build_object('ok', false);
  end if;

  select m.* into v_member
    from public.portal_login_sessions s
    join public.portal_members m on m.id = s.member_id
   where s.token = v_token
     and s.expires_at > now()
     and m.active
   limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  update public.portal_members
     set last_seen_at = now()
   where id = v_member.id;

  return public.portal_payload(v_member);

exception
  when others then
    raise warning 'portal_get_by_token failed: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', false);
end;
$fn$;

comment on function public.portal_get_by_token(text) is
  'Session token in, portal payload out. Service role only.';


-- ---- 8. sign out ------------------------------------------------------
create or replace function public.portal_logout(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $fn$
begin
  delete from public.portal_login_sessions
   where token = nullif(btrim(coalesce(p_token, '')), '');
  return jsonb_build_object('ok', true);
exception
  when others then
    raise warning 'portal_logout failed: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', true);
end;
$fn$;


-- ---- 9. privileges ----------------------------------------------------
-- The login path is Worker-only, so the browser cannot skip the rate
-- limit by calling Supabase itself. portal_get keeps its anon grant so
-- the passcode path is not broken by this change.
revoke all on function public.portal_payload(public.portal_members) from public;
revoke all on function public.portal_login(text) from public;
revoke all on function public.portal_get_by_token(text) from public;
revoke all on function public.portal_logout(text) from public;
revoke all on function public.portal_normalize_email(text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.portal_login(text) from anon';
    execute 'revoke all on function public.portal_get_by_token(text) from anon';
    execute 'revoke all on function public.portal_logout(text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.portal_payload(public.portal_members) to service_role';
    execute 'grant execute on function public.portal_login(text) to service_role';
    execute 'grant execute on function public.portal_get_by_token(text) to service_role';
    execute 'grant execute on function public.portal_logout(text) to service_role';
    execute 'grant execute on function public.portal_normalize_email(text) to service_role';
    execute 'grant select, insert, update, delete on table public.portal_login_sessions to service_role';
  end if;
end
$$;

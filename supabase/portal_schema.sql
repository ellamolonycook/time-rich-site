-- =====================================================================
-- Time Rich accelerator portal - database setup
-- Target: Supabase (PostgreSQL 15+). Paste into the SQL editor and run.
--
-- Safe to run more than once: every object is created with
-- "if not exists" or "create or replace", and the seed inserts skip
-- rows that are already there (they never overwrite edits you have
-- made in the dashboard).
--
-- Access model
--   There is no Supabase Auth. Each person has their own passcode.
--   All four tables have row level security ON and NO policies, so the
--   anon and authenticated roles cannot read or write them at all.
--   The only way in from outside is public.portal_get(p_code), which is
--   SECURITY DEFINER and runs as the table owner.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Extensions
--    pgcrypto gives us gen_random_bytes(), a cryptographic random
--    source, for the passcode generator. On Supabase both the schema
--    and the extension already exist, so these are no-ops there.
-- ---------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------------
-- 1. Passcode helpers
-- ---------------------------------------------------------------------

-- Normalise a passcode for comparison: drop surrounding whitespace,
-- drop the dash (and any other punctuation), uppercase the rest.
-- So 'abcde-fghjk', ' ABCDEFGHJK ' and 'AbCdE-FgHjK' all match.
--
-- IMMUTABLE so it can back a unique index. Every call is qualified with
-- pg_catalog rather than relying on a search_path, which keeps it both
-- safely indexable and impossible to shadow. It reads no data, so it is
-- left executable by all; revoking it would break index maintenance for
-- non-owner writers.
create or replace function public.portal_normalize_code(p_code text)
returns text
language sql
immutable
as $fn$
  select pg_catalog.upper(
           pg_catalog.regexp_replace(
             pg_catalog.btrim(coalesce(p_code, '')),
             '[^A-Za-z0-9]', '', 'g'))
$fn$;

comment on function public.portal_normalize_code(text) is
  'Canonical form of a passcode: trimmed, punctuation removed, uppercased.';


-- Generate a fresh passcode: 10 characters as XXXXX-XXXXX.
--
-- Alphabet is 31 characters - digits 2-9 and A-Z with the look-alikes
-- 0, O, 1, I and L removed - so a code can be read aloud or copied off
-- a screen without ambiguity. Keyspace is 31^10, about 8.2e14.
--
-- Random bytes come from pgcrypto's gen_random_bytes(). Bytes of 248 or
-- more are thrown away before the modulo, because 256 is not a multiple
-- of 31 and keeping them would make the first 8 letters of the alphabet
-- slightly more likely than the rest.
create or replace function public.portal_new_passcode()
returns text
language plpgsql
volatile
set search_path = pg_catalog, extensions, public
as $fn$
declare
  k_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  -- 31 chars
  k_size     constant int  := 31;
  k_ceiling  constant int  := 248;   -- 8 * 31; reject bytes at or above this
  v_code     text := '';
  v_chunk    bytea;
  v_byte     int;
  i          int;
begin
  while length(v_code) < 10 loop
    v_chunk := gen_random_bytes(16);
    for i in 0..15 loop
      exit when length(v_code) >= 10;
      v_byte := get_byte(v_chunk, i);
      continue when v_byte >= k_ceiling;
      v_code := v_code || substr(k_alphabet, (v_byte % k_size) + 1, 1);
    end loop;
  end loop;

  return substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);
end;
$fn$;

comment on function public.portal_new_passcode() is
  'Random 10-character passcode as XXXXX-XXXXX, no look-alike characters.';


-- ---------------------------------------------------------------------
-- 2. Tables
--    RLS is enabled on all four and no policies are defined, which
--    denies anon and authenticated everything. The explicit revokes
--    further down are belt and braces against Supabase default grants.
-- ---------------------------------------------------------------------

create table if not exists public.portal_members (
  id            uuid        primary key default gen_random_uuid(),
  full_name     text,
  email         text        unique,
  passcode      text        not null unique default public.portal_new_passcode(),
  role          text        not null default 'buyer'
                              check (role in ('buyer', 'second_seat', 'team')),
  order_id      text,
  active        boolean     not null default true,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create table if not exists public.portal_weeks (
  id          integer     primary key check (id between 0 and 4),
  title       text        not null,
  summary     text,
  release_at  timestamptz not null
);

create table if not exists public.portal_items (
  id         bigint  generated always as identity primary key,
  week_id    integer not null references public.portal_weeks(id) on delete cascade,
  kind       text    not null check (kind in ('video', 'link', 'text')),
  title      text    not null,
  body       text,
  url        text,
  sort       integer not null default 0,
  published  boolean not null default false
);

create table if not exists public.portal_sessions (
  id             bigint      generated always as identity primary key,
  week_id        integer     references public.portal_weeks(id) on delete set null,
  title          text        not null,
  starts_at      timestamptz not null,
  join_url       text,
  recording_url  text,
  -- Add Event page for this session. Null or empty hides the portal's
  -- "Add to calendar" button.
  addevent_url   text
);

-- One row per signed-in browser. See portal_login() below.
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

alter table public.portal_members        enable row level security;
alter table public.portal_weeks          enable row level security;
alter table public.portal_items          enable row level security;
alter table public.portal_sessions       enable row level security;
alter table public.portal_login_sessions enable row level security;

comment on table public.portal_members is
  'One row per person with portal access. Reachable only through portal_get().';
comment on column public.portal_members.passcode is
  'Stored as generated, XXXXX-XXXXX. Compared case-insensitively with the dash ignored.';
comment on table public.portal_weeks is
  'Week 0 is "Start here". A week is unlocked once release_at has passed.';
comment on table public.portal_items is
  'Week content. Only rows with published = true are ever returned.';
comment on table public.portal_sessions is
  'The live calls. starts_at is stored as timestamptz from America/New_York wall time.';


-- Indexes.
-- The normalised unique index is what actually guarantees two members
-- cannot end up with codes that collide at lookup time, and it is the
-- index portal_get() uses.
create unique index if not exists portal_members_passcode_norm_idx
  on public.portal_members (public.portal_normalize_code(passcode));

create unique index if not exists portal_members_email_lower_idx
  on public.portal_members (lower(email)) where email is not null;

create index if not exists portal_items_week_sort_idx
  on public.portal_items (week_id, sort, id);

create index if not exists portal_sessions_starts_at_idx
  on public.portal_sessions (starts_at);


-- ---------------------------------------------------------------------
-- 3. The one public function
-- ---------------------------------------------------------------------

-- portal_get(p_code text) returns jsonb
--
-- The only entry point the public pages call. Takes a passcode, returns
-- everything that page needs in one object.
--
-- The passcode is trimmed, the dash is ignored and the comparison is
-- case-insensitive, so 'abcde-fghjk' and ' ABCDEFGHJK ' both work.
--
-- On a bad or inactive code it returns immediately, with no hint as
-- to which of the two it was:
--
--   { "ok": false }
--
-- On a good code it stamps last_seen_at and returns:
--
--   {
--     "ok": true,
--     "member": {
--       "first_name": "Ella",          -- first word of full_name, may be null
--       "role": "buyer"                -- buyer | second_seat | team
--     },
--     "weeks": [                       -- every week, ascending by id
--       {
--         "id": 0,
--         "title": "Start here",
--         "summary": null,
--         "release_at": "2026-10-03T09:00:00+00:00",
--         "unlocked": true,            -- release_at <= now()
--         "items": [                   -- [] when the week is locked
--           {
--             "id": 1,
--             "kind": "video",         -- video | link | text
--             "title": "Welcome",
--             "body": null,
--             "url": "https://...",
--             "sort": 0
--           }
--         ]
--       }
--     ],
--     "sessions": [                    -- every session, ascending by starts_at
--       {
--         "title": "Open Business Surgery",
--         "starts_at": "2026-10-26T16:00:00+00:00",
--         "join_url": null,
--         "recording_url": null,
--         "addevent_url": null,
--         "week_id": 1
--       }
--     ]
--   }
--
-- A locked week returns its id, title, summary and release_at so the
-- page can show "unlocks on ...", and nothing else. Its items are never
-- read. Unpublished items are never returned for any week.
--
-- Timestamps are ISO 8601 with a UTC offset, ready for new Date().
--
-- The function is volatile because it writes last_seen_at, so PostgREST
-- requires POST. supabase-js .rpc() already does that.
--
-- Note: this relies on the owner's exemption from RLS. If anyone runs
-- "alter table ... force row level security" on these tables, this
-- function stops seeing rows.
create or replace function public.portal_get(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $fn$
declare
  v_norm     text;
  v_member   public.portal_members%rowtype;
  v_weeks    jsonb;
  v_sessions jsonb;
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
      'first_name', nullif(split_part(btrim(coalesce(v_member.full_name, '')), ' ', 1), ''),
      'role',       v_member.role
    ),
    'weeks',    v_weeks,
    'sessions', v_sessions
  );

exception
  when others then
    -- Never let a Postgres error reach the public. The detail goes to
    -- the Supabase logs; the caller just sees a failed lookup.
    raise warning 'portal_get failed: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', false);
end;
$fn$;

comment on function public.portal_get(text) is
  'Public entry point. Passcode in, portal payload out. See the comment block above the function body for the JSON shape.';


-- ---------------------------------------------------------------------
-- 3b. Email login
--     portal_members.passcode is kept exactly as it was and portal_get()
--     above still works. It is simply no longer what signs a member in.
--
--       portal_login(email)        -> 30 day token + the payload
--       portal_get_by_token(token) -> the payload
--       portal_logout(token)       -> forgets one browser
--
--     Both are service_role only, so the browser cannot reach them and
--     skip the Worker's per-IP rate limit on the login route.
--
--     The full bodies live in
--     migrations/20261010090000_portal_email_login_and_addevent.sql.
--     They are not repeated here; run the migrations to get them.
--
--     SECURITY NOTE. An email address is not a secret. Anyone who knows a
--     member's address can sign in as them. The shape here already allows
--     a stronger version later: mail a one-time link to the address and
--     mint the token only when that link is opened.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 4. Privileges
--    Functions are executable by PUBLIC by default, so the revoke is
--    the part that matters. Only anon gets portal_get back.
--    The role checks let this file also run on a plain Postgres.
-- ---------------------------------------------------------------------

revoke all on function public.portal_get(text)      from public;
revoke all on function public.portal_new_passcode() from public;

do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.portal_get(text) to anon';
  end if;

  -- service_role writes members from the admin side and needs the
  -- column default to be callable.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.portal_new_passcode() to service_role';
  end if;

  -- Defence in depth on top of RLS: no direct table access at all for
  -- the two public-facing roles.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.portal_members, public.portal_weeks,
                           public.portal_items, public.portal_sessions
             from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.portal_members, public.portal_weeks,
                           public.portal_items, public.portal_sessions
             from authenticated';
  end if;
end
$do$;


-- ---------------------------------------------------------------------
-- 5. Seed
--    No people and no passcodes. No links: join_url and recording_url
--    are left null and filled in later.
--
--    Times are written as America/New_York wall time and converted with
--    "at time zone", not a fixed offset. US clocks go back on Sunday
--    1 November 2026, so 26 and 30 October are EDT (UTC-4) while
--    everything from 2 November is EST (UTC-5).
--
--    Re-running changes nothing: existing rows are left exactly as they
--    are, including any edits made since the first run.
--
--    One consequence worth knowing before this is run again. A session is
--    skipped only when a row already has that exact title AND that exact
--    starts_at, so a session that has been RETITLED here is a new row as far
--    as this file is concerned. Three of them were retitled for the final
--    schedule (9, 13 and 20 November) and one was added (18 November). On a
--    database that was seeded before that, running this inserts the new
--    titles alongside the old ones rather than replacing them, which shows
--    up as two sessions at the same time. On such a database, update the
--    three titles by hand instead:
--
--      update public.portal_sessions set title = 'Storytelling for GTM'
--       where starts_at = (timestamp '2026-11-09 12:00') at time zone 'America/New_York';
--      update public.portal_sessions set title = 'The AI Content Machine + Q&A'
--       where starts_at = (timestamp '2026-11-13 12:00') at time zone 'America/New_York';
--      update public.portal_sessions set title = 'Q&A Exited Founder'
--       where starts_at = (timestamp '2026-11-20 12:00') at time zone 'America/New_York';
--
--    The 18 November row is genuinely new, so it is the one case the insert
--    below handles correctly on an existing database.
-- ---------------------------------------------------------------------

insert into public.portal_weeks (id, title, summary, release_at) values
  (0, 'Start here', null, now()),
  (1, 'Week 1',     null, (timestamp '2026-10-26 00:00') at time zone 'America/New_York'),
  (2, 'Week 2',     null, (timestamp '2026-11-02 00:00') at time zone 'America/New_York'),
  (3, 'Week 3',     null, (timestamp '2026-11-09 00:00') at time zone 'America/New_York'),
  (4, 'Week 4',     null, (timestamp '2026-11-16 00:00') at time zone 'America/New_York')
on conflict (id) do nothing;


insert into public.portal_sessions (week_id, title, starts_at)
select v.week_id, v.title, v.starts_at
  from (values
    (1, 'Open Business Surgery'::text,
        (timestamp '2026-10-26 12:00') at time zone 'America/New_York'),
    (1, 'Training Your Agent',
        (timestamp '2026-10-30 12:00') at time zone 'America/New_York'),
    (2, 'Your AI Operating System',
        (timestamp '2026-11-02 12:00') at time zone 'America/New_York'),
    (2, 'Expert Q&A',
        (timestamp '2026-11-06 12:00') at time zone 'America/New_York'),
    (3, 'Storytelling for GTM',
        (timestamp '2026-11-09 12:00') at time zone 'America/New_York'),
    (3, 'The AI Content Machine + Q&A',
        (timestamp '2026-11-13 12:00') at time zone 'America/New_York'),
    (4, 'Unfair AI Advantage',
        (timestamp '2026-11-16 12:00') at time zone 'America/New_York'),
    (4, 'Networking Session',
        (timestamp '2026-11-18 12:00') at time zone 'America/New_York'),
    (4, 'Q&A Exited Founder',
        (timestamp '2026-11-20 12:00') at time zone 'America/New_York')
  ) as v(week_id, title, starts_at)
 where not exists (
   select 1
     from public.portal_sessions s
    where s.title = v.title
      and s.starts_at = v.starts_at
 );


-- ---------------------------------------------------------------------
-- 6. Adding a member (run by hand, not part of the seed)
--
--   insert into public.portal_members (full_name, email, role, order_id)
--   values ('Jane Doe', 'jane@example.com', 'buyer', 'TC-1234')
--   returning full_name, email, passcode;
--
-- The passcode is generated for you, and the returning clause is the
-- only convenient moment to read it. To take someone's access away,
-- set active = false rather than deleting the row.
--
-- Sanity checks:
--
--   select public.portal_new_passcode();
--
--   select id, title, release_at, release_at <= now() as unlocked
--     from public.portal_weeks order by id;
--
--   select title, starts_at at time zone 'America/New_York' as et
--     from public.portal_sessions order by starts_at;
--
--   select public.portal_get('not-a-real-code');   -- {"ok": false}
-- ---------------------------------------------------------------------

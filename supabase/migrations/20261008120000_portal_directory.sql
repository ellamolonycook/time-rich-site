-- =====================================================================
-- Time Rich Members: the portal member directory.
--
-- portal_directory holds one public-facing profile per accelerator
-- member (buyers and second seats only). The Worker fills it from the
-- Superhuman questionnaire in Notion; members never type anything twice.
-- Resubmitting the questionnaire is how a member edits their profile.
--
-- portal_settings holds runtime switches. 'directory_enabled' starts
-- false: the page stays hidden from members until it is flipped on
-- (planned for Mon 2 Nov). Team can see it before then for QA.
--
-- Access model, same as the rest of the portal: RLS on, NO policies,
-- explicit revokes for anon and authenticated. Only the Worker, using
-- the service role key, reads or writes these tables. The browser gets
-- profiles through POST /portal-directory, which re-checks the passcode
-- and the switch and never returns email or photo_source_url.
--
-- Safe to run more than once.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------
create table if not exists public.portal_directory (
  email             text        primary key
                                  check (email = lower(btrim(email)) and email <> ''),
  name              text,
  hook_line         text,
  title             text,
  company           text,
  company_does      text,
  who_they_serve    text,
  superpower        text,
  linkedin          text,
  instagram         text,
  other_links       text,
  photo_path        text,
  photo_status      text        not null default 'missing'
                                  check (photo_status in ('ok', 'failed', 'missing')),
  photo_source_url  text,
  role              text        check (role in ('buyer', 'second_seat')),
  updated_at        timestamptz not null default now()
);

alter table public.portal_directory enable row level security;

comment on table public.portal_directory is
  'One profile per accelerator member, synced by the Worker from the Superhuman '
  'questionnaire. Read only through POST /portal-directory.';
comment on column public.portal_directory.email is
  'Lowercased. The join key to portal_members and the Notion row. Never sent to the browser.';
comment on column public.portal_directory.other_links is
  'One https URL per line, as entered in the questionnaire.';
comment on column public.portal_directory.photo_path is
  'Object name inside the private Storage bucket "portal-directory", e.g. "<sha256(email)>.jpg". '
  'Served only as a short-lived signed URL.';
comment on column public.portal_directory.photo_status is
  'ok = photo stored; failed = the Drive link could not be fetched as an image; '
  'missing = no link given yet.';
comment on column public.portal_directory.photo_source_url is
  'The last Google Drive link that was downloaded successfully. The Worker re-downloads '
  'only when the submitted link differs from this, or when photo_status is failed or '
  'missing. Never sent to the browser.';

-- ---------------------------------------------------------------------
-- 2. Settings
-- ---------------------------------------------------------------------
create table if not exists public.portal_settings (
  key    text  primary key,
  value  jsonb not null
);

alter table public.portal_settings enable row level security;

comment on table public.portal_settings is
  'Runtime switches read by the Worker. directory_enabled: show Time Rich Members '
  'to buyers and second seats (team always sees it).';

-- Seeded off. "do nothing" so a re-run never switches a live directory back off.
insert into public.portal_settings (key, value)
values ('directory_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 3. Privileges
--    Defence in depth on top of RLS: no direct access for the two
--    public-facing roles. The role checks let this run on plain Postgres.
-- ---------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.portal_directory, public.portal_settings from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.portal_directory, public.portal_settings from authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete
               on public.portal_directory, public.portal_settings
               to service_role';
  end if;

  -- The Worker checks portal_members (active, role) before listing anyone.
  -- portal_schema.sql gives service_role no table grant there, so without
  -- this line a fresh setup answers that lookup with a 403. Read only: the
  -- directory never writes to portal_members.
  if exists (select 1 from pg_roles where rolname = 'service_role')
     and to_regclass('public.portal_members') is not null then
    execute 'grant select on public.portal_members to service_role';
  end if;
end
$do$;

-- ---------------------------------------------------------------------
-- 4. Photo bucket
--    Private, images only, 5 MB cap. No storage policies: with RLS on and
--    no policy, anon and authenticated cannot list, read or write it, so
--    the only way to a photo is a signed URL minted with the service key.
--    Skipped on a plain Postgres that has no Storage schema.
-- ---------------------------------------------------------------------
do $do$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('portal-directory', 'portal-directory', false, 5242880,
            array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public             = false,
          file_size_limit    = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$do$;

commit;

-- ---------------------------------------------------------------------
-- Launch (Mon 2 Nov):
--   update public.portal_settings set value = 'true'::jsonb
--    where key = 'directory_enabled';
-- ---------------------------------------------------------------------

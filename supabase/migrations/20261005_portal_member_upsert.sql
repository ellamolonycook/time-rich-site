-- =====================================================================
-- Migration: portal member upsert from the Worker
-- Run once in the Supabase SQL editor. It does not touch the seed rows
-- and is safe to run again (every step is guarded or "create or replace").
--
-- What it does
--   1. Stops if two existing members would collide once their emails are
--      trimmed and lowercased, and lists them. Nothing is changed until
--      those rows are merged by hand.
--   2. Fixes up existing emails: trims and lowercases them, and turns an
--      empty string into null.
--   3. Adds a check so every stored email is already trimmed and lowercase,
--      which makes the existing unique (email) constraint the duplicate key.
--   4. Adds portal_upsert_member(), callable by service_role only. The
--      Worker uses it to add ThriveCart buyers and their +1.
--
-- Access model is unchanged: RLS on, no policies, anon/authenticated have
-- no table privileges, and anon can still execute only portal_get().
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Duplicate check. Raises (and rolls everything back) if any two rows
--    share an email after normalising. Check the error text for the list.
-- ---------------------------------------------------------------------
do $do$
declare
  v_dupes text;
begin
  select string_agg(norm || ' (' || n || ' rows)', ', ')
    into v_dupes
    from (
      select lower(btrim(email)) as norm, count(*) as n
        from public.portal_members
       where email is not null and btrim(email) <> ''
       group by lower(btrim(email))
      having count(*) > 1
    ) d;

  if v_dupes is not null then
    raise exception 'portal_members has emails that collide once trimmed and lowercased: %. Merge or fix these rows by hand, then run this migration again.', v_dupes;
  end if;
end
$do$;

-- ---------------------------------------------------------------------
-- 2. Fix-up existing rows. Passcodes, roles and everything else are left
--    alone; only the email column is rewritten, and only where it differs.
-- ---------------------------------------------------------------------
update public.portal_members
   set email = nullif(lower(btrim(email)), '')
 where email is distinct from nullif(lower(btrim(email)), '');

-- ---------------------------------------------------------------------
-- 3. The lowercase rule.
-- ---------------------------------------------------------------------
do $do$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'portal_members_email_normalized'
       and conrelid = 'public.portal_members'::regclass
  ) then
    alter table public.portal_members
      add constraint portal_members_email_normalized
      check (email is null or (email = lower(btrim(email)) and email <> ''));
  end if;
end
$do$;

-- ---------------------------------------------------------------------
-- 4. portal_upsert_member(p_email, p_full_name, p_role, p_order_id)
--
--    Inserts a member, or updates the one with that email. Never reads,
--    writes or returns a passcode: a new row gets the column default
--    (portal_new_passcode()) and an existing row keeps the code it has.
--
--    Role rule: buyer and team outrank second_seat. A second_seat upsert
--    on a row that is already a buyer or team leaves its role AND its
--    order_id alone (that person is attached to their own order). A buyer
--    upsert on a second_seat row upgrades it.
--
--    active is never changed here, so a member switched off by hand stays
--    off.
--
--    Returns {"ok": true, "id": <uuid>, "created": <bool>}.
-- ---------------------------------------------------------------------
create or replace function public.portal_upsert_member(
  p_email     text,
  p_full_name text,
  p_role      text,
  p_order_id  text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $fn$
declare
  v_email   text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name    text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_order   text := nullif(btrim(coalesce(p_order_id, '')), '');
  v_id      uuid;
  v_created boolean;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'portal_upsert_member: invalid email' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('buyer', 'second_seat') then
    raise exception 'portal_upsert_member: role must be buyer or second_seat' using errcode = '22023';
  end if;

  insert into public.portal_members as m (email, full_name, role, order_id)
  values (v_email, left(v_name, 200), p_role, left(v_order, 100))
  on conflict (email) do update
     set full_name = coalesce(excluded.full_name, m.full_name),
         role      = case
                       when excluded.role = 'second_seat' and m.role in ('buyer', 'team')
                         then m.role
                       else excluded.role
                     end,
         order_id  = case
                       when excluded.role = 'second_seat' and m.role in ('buyer', 'team')
                         then m.order_id
                       else coalesce(excluded.order_id, m.order_id)
                     end
  returning m.id, (m.xmax = 0) into v_id, v_created;

  return jsonb_build_object('ok', true, 'id', v_id, 'created', v_created);
end;
$fn$;

comment on function public.portal_upsert_member(text, text, text, text) is
  'Worker-only (service_role). Adds or updates a portal member by email. Never touches passcodes.';

revoke all on function public.portal_upsert_member(text, text, text, text) from public;

do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.portal_upsert_member(text, text, text, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.portal_upsert_member(text, text, text, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.portal_upsert_member(text, text, text, text) to service_role';
  end if;
end
$do$;

commit;

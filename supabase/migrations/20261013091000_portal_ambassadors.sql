-- =====================================================================
-- Portal: ambassador access, by allowlist.
--
-- Ambassadors who filled timerich.ai/superhuman get into the portal and
-- see exactly what a buyer sees.
--
-- THE SECURITY POINT. Sign-in is email only and /superhuman is a public
-- form, so the answer "I am an ambassador" cannot be what grants access:
-- anyone could pick that option and be let in. The form answer is only a
-- request. Access comes from this allowlist, which only the team can
-- write, and the two have to agree before a member row is created.
--
-- Order of events either way round:
--   allowlisted first, then fills the form -> the Worker creates the row
--   fills the form first, then allowlisted  -> add_ambassador() creates it
--
-- Safe to run more than once.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. 'ambassador' becomes a role.
--
--    The original constraint was written inline on the column, so it is
--    named portal_members_role_check. Found by definition as well, the
--    way the portal_items kind migration does it, so an older copy under
--    another name is still replaced rather than left behind.
-- ---------------------------------------------------------------------
do $$
declare
  v_name text;
begin
  select con.conname
    into v_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'portal_members'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%role%'
   limit 1;

  if v_name is not null then
    execute format('alter table public.portal_members drop constraint %I', v_name);
  end if;
end
$$;

alter table public.portal_members
  add constraint portal_members_role_check
  check (role in ('buyer', 'second_seat', 'team', 'ambassador'));

comment on column public.portal_members.role is
  'buyer | second_seat | team | ambassador. An ambassador sees what a buyer '
  'sees and is left out of the member directory.';


-- ---------------------------------------------------------------------
-- 2. The allowlist.
--
--    One row per ambassador the team has approved. Emails are stored
--    lowercase and trimmed, which is the same shape portal_members uses,
--    so the two always compare equal.
-- ---------------------------------------------------------------------
create table if not exists public.portal_ambassador_allowlist (
  email     text        primary key,
  name      text,
  added_at  timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'portal_ambassador_allowlist_email_normalized'
       and conrelid = 'public.portal_ambassador_allowlist'::regclass
  ) then
    alter table public.portal_ambassador_allowlist
      add constraint portal_ambassador_allowlist_email_normalized
      check (email = lower(btrim(email)) and email <> '');
  end if;
end
$$;

alter table public.portal_ambassador_allowlist enable row level security;

comment on table public.portal_ambassador_allowlist is
  'Ambassadors the team has approved. RLS on with no policies: reachable '
  'only through the functions below, which are service_role only.';

revoke all on table public.portal_ambassador_allowlist from public;
do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.portal_ambassador_allowlist from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.portal_ambassador_allowlist from authenticated';
  end if;
end
$do$;


-- ---------------------------------------------------------------------
-- 3. portal_upsert_member learns the new role.
--
--    Precedence, highest first: team, buyer, second_seat, ambassador.
--    An ambassador upsert on a row that is already a buyer, a second
--    seat or team leaves that row completely alone, so somebody who
--    bought a seat can never be demoted by filling the public form.
--    Going the other way still works: a buyer upsert on an ambassador
--    row upgrades it.
--
--    Everything else is unchanged from
--    20261005_portal_member_upsert.sql: passcodes are never read or
--    written, and active is never touched.
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
  if p_role is null or p_role not in ('buyer', 'second_seat', 'ambassador') then
    raise exception 'portal_upsert_member: role must be buyer, second_seat or ambassador' using errcode = '22023';
  end if;

  insert into public.portal_members as m (email, full_name, role, order_id)
  values (v_email, left(v_name, 200), p_role, left(v_order, 100))
  on conflict (email) do update
     set full_name = coalesce(excluded.full_name, m.full_name),
         role      = case
                       when m.role = 'team'
                         then m.role
                       when excluded.role = 'ambassador' and m.role in ('buyer', 'second_seat')
                         then m.role
                       when excluded.role = 'second_seat' and m.role = 'buyer'
                         then m.role
                       else excluded.role
                     end,
         order_id  = case
                       when m.role = 'team'
                         then m.order_id
                       when excluded.role = 'ambassador' and m.role in ('buyer', 'second_seat')
                         then m.order_id
                       when excluded.role = 'second_seat' and m.role = 'buyer'
                         then m.order_id
                       else coalesce(excluded.order_id, m.order_id)
                     end
  returning m.id, (m.xmax = 0) into v_id, v_created;

  return jsonb_build_object('ok', true, 'id', v_id, 'created', v_created);
end;
$fn$;

comment on function public.portal_upsert_member(text, text, text, text) is
  'Worker-only (service_role). Adds or updates a portal member by email. '
  'Never touches passcodes. Never downgrades: team > buyer > second_seat > ambassador.';


-- ---------------------------------------------------------------------
-- 4. portal_ambassador_allowed(email) -> boolean
--
--    What the Worker asks after someone picks "Ambassador" on the public
--    form. It answers only yes or no, so the allowlist itself never
--    leaves the database.
-- ---------------------------------------------------------------------
create or replace function public.portal_ambassador_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $fn$
  select exists (
    select 1
      from public.portal_ambassador_allowlist a
     where a.email = nullif(lower(btrim(coalesce(p_email, ''))), '')
  );
$fn$;

comment on function public.portal_ambassador_allowed(text) is
  'True when this email is an approved ambassador. Service role only.';


-- ---------------------------------------------------------------------
-- 5. add_ambassador(email, name)
--
--    The team's one step. Puts the address on the allowlist AND creates
--    or updates the member row, so it works whether the person has
--    already filled the form or has not touched it yet.
--
--    It will not demote anyone: run it on a buyer and the allowlist row
--    is added while the buyer row stays a buyer.
--
--    Returns {"ok": true, "email": ..., "allowlisted": <bool>, "member": {...}}
--    where allowlisted is true when this call added the allowlist row.
-- ---------------------------------------------------------------------
create or replace function public.add_ambassador(p_email text, p_name text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $fn$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_added boolean;
  v_member jsonb;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'add_ambassador: invalid email' using errcode = '22023';
  end if;

  insert into public.portal_ambassador_allowlist (email, name)
  values (v_email, v_name)
  on conflict (email) do update
     set name = coalesce(excluded.name, public.portal_ambassador_allowlist.name)
  returning (xmax = 0) into v_added;

  v_member := public.portal_upsert_member(v_email, v_name, 'ambassador', null);

  return jsonb_build_object(
    'ok', true,
    'email', v_email,
    'allowlisted', v_added,
    'member', v_member
  );
end;
$fn$;

comment on function public.add_ambassador(text, text) is
  'Team only (service_role). Allowlists an ambassador and gives them portal '
  'access in one step. Never demotes an existing buyer, second seat or team row.';


-- ---------------------------------------------------------------------
-- 6. Grants. Same shape as every other portal function: nothing for the
--    browser-facing roles, execute for service_role.
-- ---------------------------------------------------------------------
revoke all on function public.portal_ambassador_allowed(text) from public;
revoke all on function public.add_ambassador(text, text) from public;

do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.portal_ambassador_allowed(text) from anon';
    execute 'revoke all on function public.add_ambassador(text, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.portal_ambassador_allowed(text) from authenticated';
    execute 'revoke all on function public.add_ambassador(text, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.portal_ambassador_allowed(text) to service_role';
    execute 'grant execute on function public.add_ambassador(text, text) to service_role';
  end if;
end
$do$;

commit;

-- ---------------------------------------------------------------------
-- Adding an ambassador (run by hand, not part of the seed)
--
--   select public.add_ambassador('jane@example.com', 'Jane Doe');
--
-- Taking access away:
--
--   delete from public.portal_ambassador_allowlist where email = 'jane@example.com';
--   update public.portal_members set active = false
--    where email = 'jane@example.com' and role = 'ambassador';
--
-- The delete alone stops a NEW row being made from the form; the member
-- row already there keeps working until it is switched off.
-- ---------------------------------------------------------------------

-- =====================================================================
-- Allow kind = 'skill' in portal_items.
--
-- A skill item is a downloadable Superhuman skill. Its `url` column does
-- NOT hold a link: it holds the file name inside the PRIVATE Storage
-- bucket "portal-skills", for example "superhuman.zip".
--
-- Nothing in the browser can read that bucket. portal_get() still returns
-- the file name, which is not a secret on its own; the bytes are only ever
-- reachable through a short-lived signed URL minted by the Worker route
-- POST /portal-download, which re-checks the passcode and the week's
-- release date before signing.
--
-- Safe to run more than once.
-- =====================================================================

begin;

-- The original constraint was written inline on the column, so Postgres
-- named it portal_items_kind_check. Drop by that name if it is there, and
-- fall back to finding it by definition if an older copy was named
-- differently.
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
     and rel.relname = 'portal_items'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%kind%'
   limit 1;

  if v_name is not null then
    execute format('alter table public.portal_items drop constraint %I', v_name);
  end if;
end
$$;

alter table public.portal_items
  add constraint portal_items_kind_check
  check (kind in ('video', 'link', 'text', 'skill'));

comment on column public.portal_items.url is
  'For kind = video or link: the URL. For kind = skill: the file name in the '
  'private Storage bucket "portal-skills" (e.g. "superhuman.zip"), never a URL. '
  'Skill bytes are served only through a signed URL from POST /portal-download.';

-- The download Worker calls portal_get() with the service role key. The grant
-- is already in place on the live database; this records it so a rebuild from
-- these migrations ends up in the same state.
grant execute on function public.portal_get(text) to service_role;

commit;

-- ---------------------------------------------------------------------
-- The bucket itself is created once, by hand or by the Storage API:
--
--   insert into storage.buckets (id, name, public)
--   values ('portal-skills', 'portal-skills', false)
--   on conflict (id) do update set public = false;
--
-- Leave it private and add NO storage policies. With RLS on and no policy,
-- the anon and authenticated roles cannot list, read or write the bucket,
-- so the only way in is a signed URL minted with the service role key.
-- ---------------------------------------------------------------------

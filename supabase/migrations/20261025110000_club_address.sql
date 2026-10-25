-- =====================================================================
-- The portal moved from timerich.ai/portal to timerich.ai/club (25 Oct).
--
-- Any curriculum row that links into the portal gets the new address,
-- extensionless, the way the nav links are written. Today that is the
-- "Set your 90-day goal with your AI" link written by
-- 20261017090000_week1_voice_setup.sql, but it is matched on the URL
-- rather than the id, so a row added since is caught too.
--
-- The old address still works -- portal/*.html are redirect pages now --
-- so this is tidiness rather than a fix: it saves a member the hop, and
-- it keeps the old address out of anything copied from the page.
--
-- The hash is kept; it is what lands the member on the right heading.
-- Only https://timerich.ai/portal/<page> is touched, which leaves the
-- images under /portal/assets alone (they did not move). Safe to run
-- more than once: a second run finds nothing left to match.
-- =====================================================================

begin;

update public.portal_items
   set url = regexp_replace(
               url,
               '^https://timerich\.ai/portal/([a-z-]+)(\.html)?',
               'https://timerich.ai/club/\1')
 where url ~ '^https://timerich\.ai/portal/[a-z-]+(\.html)?([?#]|$)'
   -- These two did not keep their names (the Club home is /club, the
   -- sign-in page /club/signin), and their redirects cover them anyway.
   and url !~ '^https://timerich\.ai/portal/(club|index)(\.html)?([?#]|$)';

commit;

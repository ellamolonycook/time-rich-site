-- ---------------------------------------------------------------------
-- Portal QA, batch 1. One content correction, data rather than code.
--
-- "Q&A Exited Founder" reads as a typo. It becomes "Q&A: Exited Founder".
-- The session is matched on its start time, not its title, so this is
-- safe to run more than once and does nothing on a database that has
-- already had it.
--
-- The AddEvent page for 20 November still carries the old wording. That
-- is edited in AddEvent, not here.
-- ---------------------------------------------------------------------

update public.portal_sessions
   set title = 'Q&A: Exited Founder'
 where starts_at = (timestamp '2026-11-20 12:00') at time zone 'America/New_York'
   and title = 'Q&A Exited Founder';

-- =====================================================================
-- Week 1 content: one guided setup, spoken rather than typed.
--
-- Week 0 keeps its id and its release_at. Nothing moves between weeks and
-- no release date changes: portal-setup's learningCard already shows week 0
-- as a "Start here" block inside the Week 1 card, so the grouping is a
-- presentation job that is already done. This migration is content only.
--
-- What changes:
--   * week 0 is retitled and resummarised for the new flow
--   * four rows are unpublished (never deleted): the skill packs, the
--     "how to install a skill" note, and the calendar link the dashboard's
--     Set up once card now owns
--   * the welcome, the COMPASS row and the week 1 setup row are rewritten
--   * nine rows are added: Wispr Flow, the hotkeys, six voice prompts and
--     the Notion workbook
--
-- Safe to run more than once. Every insert is guarded on its own title, and
-- every update is by primary key.
--
-- Sort is reassigned in tens so a row can be slipped in later without
-- renumbering the rest.
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. The week itself
-- ---------------------------------------------------------------------

update public.portal_weeks
   set title   = 'Week 1: Start here',
       summary = 'Set up before kickoff on Monday 26 October. Speak your answers, don''t type them.'
 where id = 0;


-- ---------------------------------------------------------------------
-- 2. Out of sight, not deleted
--
--    The two skill packs and the note explaining how to install one: the
--    Prompts page hands over a prompt now, so there is nothing to install.
--    The calendar link: the Set up once card on the dashboard does this.
--    Set published = false so the rows keep their ids and their ticks.
-- ---------------------------------------------------------------------

update public.portal_items
   set published = false
 where id in (
   9,    -- How to install a skill
   11,   -- Business COMPASS            (compass-superhuman.zip)
   19,   -- Lock down my Claude         (security-superhuman.zip)
   7     -- Add every session to your calendar
 );


-- ---------------------------------------------------------------------
-- 3. The rows that stay, rewritten
-- ---------------------------------------------------------------------

-- Welcome.
update public.portal_items
   set body = 'Over the next 4 weeks you''ll build a real part of your business on AI, live, with founders who have done it. A new week opens here every Monday. Work through the steps below before Monday 26 October.',
       sort = 10
 where id = 4;

-- The COMPASS copy. The link is unchanged; every mention of a skill or a
-- download is gone, because neither is part of this any more.
update public.portal_items
   set title = 'Make your copy of the Business COMPASS',
       body  = 'Click to make your own copy. Keep it open: the voice prompts below fill it in.',
       sort  = 20
 where id = 5;

-- The onboarding questions and the WhatsApp group are unchanged apart from
-- where they sit in the list.
update public.portal_items set sort = 120 where id = 6;   -- onboarding questions
update public.portal_items set sort = 130 where id = 8;   -- WhatsApp group

-- Week 1's own row. It was a skill pack; it is now a link into the Prompts
-- page, at the anchor on the "Set up your AI" heading.
--
-- Absolute https on purpose: portal-live.js only renders a link whose URL
-- parses and is https (safeUrl), so a relative path would quietly render as
-- plain text with nothing to click.
update public.portal_items
   set kind  = 'link',
       title = 'Set your 90-day goal with your AI',
       body  = 'Open it in your AI with the prompt already filled in. No installs.',
       url   = 'https://timerich.ai/portal/prompts.html#set-up-your-ai',
       sort  = 10
 where id = 10;

-- Any other skill pack still showing in these two weeks. The four ids above
-- are the ones on the live database today; this catches a pack added since,
-- and it is what makes the file safe to replay against a database rebuilt
-- from these migrations, where the pack rows were seeded by 20261012090000
-- and carry different ids.
--
-- It runs here, after the row above has stopped being a skill, because a
-- blanket rule earlier would have unpublished week 1's own row along with
-- the packs.
update public.portal_items
   set published = false
 where week_id in (0, 1)
   and published
   and kind = 'skill';


-- ---------------------------------------------------------------------
-- 4. The new rows
--
--    Wispr Flow first, then the hotkeys, then one row per COMPASS section
--    to speak into, then the Notion workbook.
--
--    Guarded on title within week 0, so a second run inserts nothing.
-- ---------------------------------------------------------------------

insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select v.week_id, v.kind, v.title, v.body, v.url, v.sort, true
  from (values
    (0, 'link'::text,
     'Install Wispr Flow'::text,
     'Your accelerator includes 6 months of Wispr Flow Pro. Install it on your computer and sign in.'::text,
     'https://wisprflow.ai'::text,
     30),

    (0, 'text',
     'Turn it on',
     'Hold fn on Mac (Ctrl + Opt if your Mac has no fn key) or Ctrl + Win on Windows. Speak, then let go. Your words appear wherever your cursor is. For long answers, press fn + Space (Windows: Ctrl + Win + Space) to go hands-free, and press it again to stop.',
     null,
     40),

    -- One per COMPASS section. 5, 7 and 8 are not asked for in week 1.
    (0, 'text',
     'Say it: One-liners',
     'Click into your COMPASS under 1. One-liners, hold fn and say: "What I do, who it''s for and the result they get, in one sentence, the way I''d say it on a call."',
     null,
     50),

    (0, 'text',
     'Say it: Who I serve',
     'Click into your COMPASS under 2. Who I serve, hold fn and say: "My best customers are… the problem keeping them up is… the people I turn away are…"',
     null,
     60),

    (0, 'text',
     'Say it: What I sell',
     'Click into your COMPASS under 3. What I sell, hold fn and say: "My offers are… each one costs… and people usually buy them in this order…"',
     null,
     70),

    (0, 'text',
     'Say it: My point of view',
     'Click into your COMPASS under 4. My point of view, hold fn and say: "What I believe that most people in my industry get wrong is…"',
     null,
     80),

    (0, 'text',
     'Say it: Voice',
     'Click into your COMPASS under 6. Voice, hold fn and say: "When I write, I sound like… I never sound like… I always sign off with…"',
     null,
     90),

    (0, 'text',
     'Say it: Current focus',
     'Click into your COMPASS under 9. Current focus, hold fn and say: "In 90 days I want… a number and a date. I have this many hours a week. I''ll stop doing…"',
     null,
     100),

    -- No template to point at yet, so it says so rather than carrying a
    -- placeholder in brackets.
    (0, 'text',
     'Duplicate your Superhuman OS in Notion',
     'Coming soon.',
     null,
     110)
  ) as v(week_id, kind, title, body, url, sort)
 where not exists (
   select 1
     from public.portal_items i
    where i.week_id = v.week_id
      and i.title = v.title
 );


-- ---------------------------------------------------------------------
-- 5. Guards
--
--    These are the rules the content above is written to. If a later edit
--    breaks one, this migration fails loudly rather than shipping a week 1
--    that asks a member to install something.
-- ---------------------------------------------------------------------

do $$
declare
  v_bad int;
begin
  -- Nothing published in weeks 0 or 1 may be a skill, point at a zip, or
  -- talk about installing or downloading one.
  select count(*)
    into v_bad
    from public.portal_items
   where week_id in (0, 1)
     and published
     and (
       kind = 'skill'
       or coalesce(url, '') ilike '%.zip'
       or coalesce(title, '') || ' ' || coalesce(body, '') ilike '%install a skill%'
       or coalesce(title, '') || ' ' || coalesce(body, '') ilike '%download%'
       or coalesce(title, '') || ' ' || coalesce(body, '') like '%[%'
       or coalesce(title, '') || ' ' || coalesce(body, '') like '%TBC%'
     );
  if v_bad > 0 then
    raise exception 'week 1 still has % published row(s) mentioning a skill, a download or a placeholder', v_bad;
  end if;

  -- No long dashes anywhere in the copy.
  select count(*)
    into v_bad
    from public.portal_items
   where week_id in (0, 1)
     and published
     and (coalesce(title, '') || ' ' || coalesce(body, '')) ~ U&'[\2013\2014]';
  if v_bad > 0 then
    raise exception 'week 1 has % published row(s) containing a long dash', v_bad;
  end if;

  -- The hotkey instructions and all six voice prompts are present.
  select count(*) into v_bad
    from public.portal_items
   where week_id = 0 and published and title = 'Turn it on' and body like '%fn + Space%';
  if v_bad <> 1 then
    raise exception 'the hotkey copy is missing from week 1';
  end if;

  select count(*) into v_bad
    from public.portal_items
   where week_id = 0 and published and title like 'Say it: %';
  if v_bad <> 6 then
    raise exception 'expected 6 voice prompts in week 1, found %', v_bad;
  end if;
end
$$;

commit;


-- ---------------------------------------------------------------------
-- After this runs, week 1 reads, in order:
--
--    10  Welcome to the Superhuman Accelerator
--    20  Make your copy of the Business COMPASS      -> Google Doc /copy
--    30  Install Wispr Flow                          -> wisprflow.ai
--    40  Turn it on
--    50  Say it: One-liners
--    60  Say it: Who I serve
--    70  Say it: What I sell
--    80  Say it: My point of view
--    90  Say it: Voice
--   100  Say it: Current focus
--   110  Duplicate your Superhuman OS in Notion
--   120  Answer the onboarding questions             -> timerich.ai/superhuman
--   130  Join the Superhuman WhatsApp group          -> WhatsApp
--
-- and the week 1 row itself:
--
--    10  Set your 90-day goal with your AI           -> Prompts, Set up your AI
--
-- To undo:
--   update public.portal_items set published = true where id in (7, 9, 11, 19);
--   delete from public.portal_items
--    where week_id = 0
--      and title in ('Install Wispr Flow', 'Turn it on',
--                    'Say it: One-liners', 'Say it: Who I serve',
--                    'Say it: What I sell', 'Say it: My point of view',
--                    'Say it: Voice', 'Say it: Current focus',
--                    'Duplicate your Superhuman OS in Notion');
-- and restore the four edited rows from a backup of their title/body/url.
-- ---------------------------------------------------------------------

-- =====================================================================
-- Curriculum: week titles, and Week 1's "Before Monday" list.
--
-- Content only. No week changes id or release_at, nothing is deleted and
-- every existing row keeps its id, so a member's ticks survive.
--
-- What changes:
--   * weeks 1 to 4 take the curriculum's titles
--   * week 0 (shown as "Start here" at the top of Week 1) gains the setup
--     steps from the curriculum's Before Monday list: a paid AI plan and
--     the desktop app, privacy settings, personal preferences, and
--     creating the Business Hub
--   * Install Wispr Flow carries the TIMERICH6 code
--   * the Notion row becomes "Duplicate the Superhuman Workbook"
--   * the rows are put in the curriculum's order. The COMPASS rows are
--     moved, not rewritten: where COMPASS lives is still being decided
--
-- Safe to run more than once. Every insert is guarded on its own title
-- within week 0, and every update is by id or by title within week 0.
-- Sort is in tens so a row can be slipped in later.
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. Week titles, as the curriculum writes them. The portal drops the
--    "Week N: " where the number is already on screen.
-- ---------------------------------------------------------------------

update public.portal_weeks set title = 'Week 1: Diagnose + Become Superhuman' where id = 1;
update public.portal_weeks set title = 'Week 2: Your AI Operating System'     where id = 2;
update public.portal_weeks set title = 'Week 3: Storytelling for GTM'         where id = 3;
update public.portal_weeks set title = 'Week 4: Unfair AI Advantage'          where id = 4;


-- ---------------------------------------------------------------------
-- 2. Rows that stay, rewritten
-- ---------------------------------------------------------------------

update public.portal_items
   set body = E'Your accelerator includes 6 months of Wispr Flow Pro. Install it on your computer.\nSign in, then Settings → Plans and Billing → promo code link at the bottom → TIMERICH6.'
 where week_id = 0 and title = 'Install Wispr Flow';

-- The Notion row. Still no public link to point at: it comes in the prep
-- email, so the row says that instead of carrying a placeholder.
update public.portal_items
   set title = 'Duplicate the Superhuman Workbook',
       body  = 'Open the Workbook link in your prep email, click Duplicate (top right) and add it to your Notion.'
 where week_id = 0 and title in ('Duplicate your Superhuman OS in Notion', 'Duplicate the Superhuman Workbook');


-- ---------------------------------------------------------------------
-- 3. The new rows, from the curriculum's Before Monday list
-- ---------------------------------------------------------------------

insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select v.week_id, v.kind, v.title, v.body, v.url, v.sort, true
  from (values
    (0, 'text'::text,
     'Get a paid AI plan and the desktop app'::text,
     'Sign up for a paid plan of the AI you''ll use (Claude Pro, ChatGPT Plus or a Google AI plan, around $20 USD a month). Install the desktop app and sign in.'::text,
     null::text,
     20),

    (0, 'text',
     'Lock down your privacy',
     E'Before you give your AI any business information, in Claude:\nSettings → Privacy → Help improve Claude: Off\nSettings → Memory → Include sensitive topics in memory: Off\nSettings → Privacy → Shared chats and Shared artifacts → Manage: Private',
     null,
     30),

    (0, 'text',
     'Tell your AI how you work',
     'Open your personal preferences (Claude: Settings → General → Personal preferences. ChatGPT: Settings → Personalization → Custom instructions) and say where you are, what your business does, and how you want answers: direct, no fluff, ask before assuming.',
     null,
     40),

    (0, 'text',
     'Create your Business Hub',
     E'In Claude, go to Projects → New project and name it Business Hub. Paste this into the project instructions:\n"This is my Business Hub. Read my Business COMPASS in Notion before any task. Everything we build here gets saved back to my Superhuman Workbook in Notion, not left in the chat."',
     null,
     80)
  ) as v(week_id, kind, title, body, url, sort)
 where not exists (
   select 1
     from public.portal_items i
    where i.week_id = v.week_id
      and i.title = v.title
 );


-- ---------------------------------------------------------------------
-- 4. The curriculum's order
--
--    paid plan, privacy, preferences, Wispr + code, duplicate the
--    Workbook, Business Hub, COMPASS, onboarding questions + WhatsApp
-- ---------------------------------------------------------------------

update public.portal_items set sort = 10  where id = 4;    -- Welcome
update public.portal_items set sort = 50  where week_id = 0 and title = 'Install Wispr Flow';
update public.portal_items set sort = 60  where week_id = 0 and title = 'Turn it on';
update public.portal_items set sort = 70  where week_id = 0 and title = 'Duplicate the Superhuman Workbook';
update public.portal_items set sort = 90  where id = 5;    -- Make your copy of the Business COMPASS
update public.portal_items set sort = 100 where week_id = 0 and title = 'Say it: One-liners';
update public.portal_items set sort = 110 where week_id = 0 and title = 'Say it: Who I serve';
update public.portal_items set sort = 120 where week_id = 0 and title = 'Say it: What I sell';
update public.portal_items set sort = 130 where week_id = 0 and title = 'Say it: My point of view';
update public.portal_items set sort = 140 where week_id = 0 and title = 'Say it: Voice';
update public.portal_items set sort = 150 where week_id = 0 and title = 'Say it: Current focus';
update public.portal_items set sort = 160 where id = 6;    -- Answer the onboarding questions
update public.portal_items set sort = 170 where id = 8;    -- Join the Superhuman WhatsApp group


-- ---------------------------------------------------------------------
-- 5. Guards: the same rules the Week 1 content is written to
-- ---------------------------------------------------------------------

do $$
declare
  v_bad int;
begin
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
    raise exception 'week 1 has % published row(s) mentioning a skill, a download or a placeholder', v_bad;
  end if;

  select count(*)
    into v_bad
    from public.portal_items
   where week_id in (0, 1)
     and published
     and (coalesce(title, '') || ' ' || coalesce(body, '')) ~ U&'[\2013\2014]';
  if v_bad > 0 then
    raise exception 'week 1 has % published row(s) containing a long dash', v_bad;
  end if;

  select count(*) into v_bad
    from public.portal_items
   where week_id = 0 and published and title = 'Install Wispr Flow' and body like '%TIMERICH6%';
  if v_bad <> 1 then
    raise exception 'the Wispr Flow step is missing its TIMERICH6 code';
  end if;

  select count(*) into v_bad
    from public.portal_items
   where week_id = 0 and published
     and title in ('Get a paid AI plan and the desktop app', 'Lock down your privacy',
                   'Tell your AI how you work', 'Create your Business Hub',
                   'Duplicate the Superhuman Workbook');
  if v_bad <> 5 then
    raise exception 'expected the 5 Before Monday setup rows in week 1, found %', v_bad;
  end if;
end
$$;

commit;


-- ---------------------------------------------------------------------
-- After this runs, Week 1's Start here reads, in order:
--
--    10  Welcome to the Superhuman Accelerator
--    20  Get a paid AI plan and the desktop app
--    30  Lock down your privacy
--    40  Tell your AI how you work
--    50  Install Wispr Flow                       (with TIMERICH6)
--    60  Turn it on
--    70  Duplicate the Superhuman Workbook
--    80  Create your Business Hub
--    90  Make your copy of the Business COMPASS   (unchanged)
--   100  Say it: One-liners ... 150 Say it: Current focus   (unchanged)
--   160  Answer the onboarding questions          (unchanged)
--   170  Join the Superhuman WhatsApp group       (unchanged)
-- ---------------------------------------------------------------------

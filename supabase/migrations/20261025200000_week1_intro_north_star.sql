-- =====================================================================
-- The #introductions format, and the North Star on paper (25 Oct).
--
-- Three rows, three edits, from Ella's review:
--
-- 1. Start here, "Introduce yourself in #introductions" (it was "Say hello
--    in #introductions"; said as an instruction it reads as a thing to do
--    rather than a place to be friendly). The row asked for "who you
--    are, what you sell, and your Q4 North Star" and got six different
--    shapes of introduction back. It now carries the format itself, in a
--    copy box: a line reading "= Copy: <label>" opens a text box with a
--    Copy button on it, rendered by bodyBlocks() in club/curriculum.html.
--    The box runs to the first blank line followed by a line hard against
--    the margin, which is the blank line before the "+ " drop-down -- so
--    the channels list under it is untouched and stays a drop-down.
--
-- 2. Week 1, "Write your North Star on paper". Five questions became four,
--    in Ella's words. The line above them and the question under them stay
--    as they are.
--
-- 3. Week 1, "Wispr your North Star into your Business Hub". The row said
--    "Q4 and Q1 goals" twice, which is two of the five questions that no
--    longer exist. Both now read "4 answers".
--
-- 4. Week 1, "Run your Time Rich Audit". Ella's prompt is the whole of the
--    row below its first line, and a member had to select it by hand. It
--    goes in a copy box, with a Copy button on it. Not a word of the prompt
--    changes: a marker line is inserted above it.
--
-- 5. Start here gains a sixth step, "Before Wednesday's live build": one
--    row that signs the member up to LaunchLemonade before the Wednesday
--    masterclass. Sort 610, so it is the first task of group 6.
--
-- 6. Every LaunchLemonade link in the portal moves to the TIMERICHLL
--    voucher. The old one was ACCELERATOR.
--
-- 7. Start here, "Create your Business Hub". The row said how to make the
--    project and nothing about connecting anything to it, so members built
--    a Hub that could not read their calendar. The connectors go under it,
--    in a "+ " drop-down, which is how a row holds a list without the task
--    itself growing to five lines. Title, sort, kind and id are untouched.
--
-- Matched on week_id and title, rewritten in place: every row keeps its id,
-- so every member's tick survives. Nothing is inserted and nothing is
-- deleted. Safe to run more than once -- a second run finds the new text
-- already there, changes nothing, and the checks still pass.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. The row's name
-- ---------------------------------------------------------------------

-- First, so every statement below names one row and one title only. A
-- second run finds it already renamed and changes nothing.
update public.portal_items
   set title = 'Introduce yourself in #introductions'
 where week_id = 0
   and title = 'Say hello in #introductions';

-- ---------------------------------------------------------------------
-- 0a. Line endings
-- ---------------------------------------------------------------------

-- The migrations that wrote these rows are dollar-quoted SQL. Run from a
-- checkout on Windows, or pasted into the Supabase editor from one, every
-- line in them ends with a carriage return and a newline -- and the
-- carriage returns go into the body. Every position() and like() below
-- looks for a blank line as two newlines, and would find none.
--
-- So the four rows are normalised to plain newlines first, once. It is the
-- same text either way: nothing a member reads changes, and a second run
-- finds no carriage returns to take out.
update public.portal_items
   set body = replace(body, chr(13), '')
 where week_id in (0, 1)
   and title in ('Introduce yourself in #introductions',
                 'Write your North Star on paper',
                 'Wispr your North Star into your Business Hub',
                 'Run your Time Rich Audit')
   and body like '%' || chr(13) || '%';

-- ---------------------------------------------------------------------
-- 1. The introduction format, in a copy box
-- ---------------------------------------------------------------------

-- Everything before the drop-down is replaced; the drop-down and the
-- channel list under it are carried over exactly as they are. Re-running
-- this replaces the same head with the same head.
--
-- The literal is stripped of carriage returns the same way the row was in
-- step 0: this file is dollar-quoted SQL, and run from a checkout with CRLF
-- endings the text between the $tr$ markers carries them too.
update public.portal_items
   set body = replace($tr$Introduce yourself in Slack in this format. Please keep it short and clear!

= Copy: Your intro
1. Name, company, city. Where you're based.
2. What your business does. The problem you solve, in one sentence.
3. Your Q4 North Star. One target, with a number and a date. Example: "3 new retainer clients by 31 December."
4. Your superpower. What you can help the other founders with.
5. What you're most excited about in the accelerator.
6. LinkedIn. Full link, so people can connect.

$tr$, chr(13), '') || substring(body from position('+ The channels' in body))
 where week_id = 0
   and title = 'Introduce yourself in #introductions'
   and position('+ The channels' in body) > 0;

-- ---------------------------------------------------------------------
-- 2. Four questions on paper, not five
-- ---------------------------------------------------------------------

-- The first paragraph and the closing question are kept as they are
-- written, rather than retyped here: only the list between them changes.
update public.portal_items
   set body = substring(body from 1 for position(E'\n\n' in body) - 1)
           || E'\n\n'
           || replace($tr$1. Q4: 1 specific target by 31 December, with a number
2. Where should my time be invested?
3. What I'll stop doing
4. 1 hour daily commitment$tr$, chr(13), '')
           || E'\n\n'
           || substring(body from position('Then ask yourself' in body))
 where week_id = 1
   and title = 'Write your North Star on paper'
   and position(E'\n\n' in body) > 0
   and position('Then ask yourself' in body) > 0;

-- ---------------------------------------------------------------------
-- 3. The Wispr row reads back four answers, not two goals
-- ---------------------------------------------------------------------

-- Twice: once in the line that tells the member what to read off their
-- paper, and once inside the prompt itself. The two phrasings differ by a
-- single word ("read your" and "read out your"), so both are named.
update public.portal_items
   set body = replace(
                replace(body, 'read out your Q4 and Q1 goals', 'read out your 4 answers'),
                'read your Q4 and Q1 goals from your paper', 'read your 4 answers from your paper')
 where week_id = 1
   and title = 'Wispr your North Star into your Business Hub'
   and (body like '%read out your Q4 and Q1 goals%'
        or body like '%read your Q4 and Q1 goals from your paper%');

-- ---------------------------------------------------------------------
-- 4. The audit prompt, in a copy box
-- ---------------------------------------------------------------------

-- One marker line, inserted above the prompt. The box runs from there to
-- the end of the body, which is "My last week:" -- so the whole prompt is
-- what the Copy button puts on the clipboard, and the line above it, which
-- is instructions to the member rather than to the AI, stays outside.
--
-- The guard is the marker itself, so a second run finds it already there.
update public.portal_items
   set body = substring(body from 1 for position('Run a Time Rich Audit on my last week.' in body) - 1)
           || '= Copy: Your audit prompt' || chr(10)
           || substring(body from position('Run a Time Rich Audit on my last week.' in body))
 where week_id = 1
   and title = 'Run your Time Rich Audit'
   and position('Run a Time Rich Audit on my last week.' in body) > 0
   and body not like '%= Copy: Your audit prompt%';

-- ---------------------------------------------------------------------
-- 5. Step 6: before Wednesday's live build
-- ---------------------------------------------------------------------

-- Start here is grouped by the hundreds digit of sort, so 610 is the first
-- task of step 6. Matched on week and title like every other row in this
-- folder, so a second run rewrites the same text in place and the row keeps
-- its id: a member's tick survives.
--
-- The body is stripped of carriage returns for the reason step 0a gives.
update public.portal_items
   set kind = 'link',
       sort = 610,
       published = true,
       url = 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL',
       body = replace($tr$Before Wednesday's live build session with Multi LLM & Setting Up Your Harness:

1. Sign up to LaunchLemonade (3 months free) using the button below.
2. Log in and check that you can access your account.

That's all you need to do before the session. Once you're logged in, please don't do anything else on the platform yet. We'll work through the setup together during the masterclass.

If you already have an account, just check that you can log in.

Any issues? Email Wilfred Soriaga at wilfredsoriaga@launchlemonade.app or DM in Slack.$tr$, chr(13), '')
 where week_id = 0
   and title = 'Sign up to LaunchLemonade (3 months free)';

insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select 0, 'link', 'Sign up to LaunchLemonade (3 months free)',
       replace($tr$Before Wednesday's live build session with Multi LLM & Setting Up Your Harness:

1. Sign up to LaunchLemonade (3 months free) using the button below.
2. Log in and check that you can access your account.

That's all you need to do before the session. Once you're logged in, please don't do anything else on the platform yet. We'll work through the setup together during the masterclass.

If you already have an account, just check that you can log in.

Any issues? Email Wilfred Soriaga at wilfredsoriaga@launchlemonade.app or DM in Slack.$tr$, chr(13), ''),
       'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL', 610, true
 where not exists (select 1 from public.portal_items
                    where week_id = 0 and title = 'Sign up to LaunchLemonade (3 months free)');

-- ---------------------------------------------------------------------
-- 6. The LaunchLemonade voucher
-- ---------------------------------------------------------------------

-- Wherever it appears, and whatever the old voucher was: one link, or
-- members land on different offers.
update public.portal_items
   set url = 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL'
 where url like '%launchlemonade.app%'
   and url <> 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL';

-- ---------------------------------------------------------------------
-- 7. The Business Hub, and how to connect it
-- ---------------------------------------------------------------------

-- The body only. The row keeps its title, its sort, its kind and its id, so
-- a member who has already ticked it stays ticked.
--
-- `is distinct from` is what makes it idempotent: a second run finds the
-- body already equal and updates nothing. The literal is stripped of
-- carriage returns for the reason step 0a gives -- the "+ " line has to
-- start a line and end one, or the drop-down never opens.
update public.portal_items
   set body = replace($tr$In Claude, open Projects, press New project and name it Business Hub. Paste this into the instructions, then add your COMPASS to the project's Files:

"This is my Business Hub. Read my Business COMPASS in this project's files before any task. If something is missing, ask me before you guess."

Every prompt in the accelerator runs in a chat inside your Business Hub.

+ How to add your connectors
1. In Claude, open Settings, then Connectors.
2. Press Browse connectors and add Gmail, Google Calendar and Google Drive, or Notion if that's where your docs live. Press Connect, sign in and allow access.
3. Wispr Flow: in the Wispr Flow app, open Settings, MCP, then Add to Claude.
4. In a chat inside your Business Hub, press the + button in the message box and check your connectors are switched on.
5. Test it: ask "What's on my calendar this week?"
Nothing sends, posts or deletes without your yes.$tr$, chr(13), '')
 where week_id = 0
   and title = 'Create your Business Hub'
   and body is distinct from replace($tr$In Claude, open Projects, press New project and name it Business Hub. Paste this into the instructions, then add your COMPASS to the project's Files:

"This is my Business Hub. Read my Business COMPASS in this project's files before any task. If something is missing, ask me before you guess."

Every prompt in the accelerator runs in a chat inside your Business Hub.

+ How to add your connectors
1. In Claude, open Settings, then Connectors.
2. Press Browse connectors and add Gmail, Google Calendar and Google Drive, or Notion if that's where your docs live. Press Connect, sign in and allow access.
3. Wispr Flow: in the Wispr Flow app, open Settings, MCP, then Add to Claude.
4. In a chat inside your Business Hub, press the + button in the message box and check your connectors are switched on.
5. Test it: ask "What's on my calendar this week?"
Nothing sends, posts or deletes without your yes.$tr$, chr(13), '');

-- ---------------------------------------------------------------------
-- What should be true afterwards
-- ---------------------------------------------------------------------

do $$
declare v integer;
begin
  -- The intro row: the copy box, all six lines, and the drop-down still
  -- under it rather than inside it.
  select count(*) into v from public.portal_items
   where week_id = 0 and published and title = 'Introduce yourself in #introductions'
     and body like '%= Copy: Your intro%'
     and body like '%1. Name, company, city.%'
     and body like '%6. LinkedIn. Full link, so people can connect.%'
     and body like '%+ The channels%'
     and body like '%#introductions%'
     and position('= Copy: Your intro' in body) < position('+ The channels' in body);
  if v <> 1 then raise exception 'the #introductions row is missing the copy box or its channel drop-down (found % rows)', v; end if;

  -- And the wording it replaced is gone, or a member sees both.
  select count(*) into v from public.portal_items
   where week_id = 0 and published and title = 'Introduce yourself in #introductions'
     and body like '%Who you are, what you sell%';
  if v <> 0 then raise exception 'the old #introductions line is still there'; end if;

  -- The North Star row: four questions, the line above and the question
  -- under them both still in place.
  select count(*) into v from public.portal_items
   where week_id = 1 and published and title = 'Write your North Star on paper'
     and body like '%Before you open any AI, write by hand:%'
     and body like '%1. Q4: 1 specific target by 31 December, with a number%'
     and body like '%4. 1 hour daily commitment%'
     and body like '%Then ask yourself:%'
     and body not like '%5. Hours a week%'
     and body not like '%Q1 North Star%';
  if v <> 1 then raise exception 'the North Star row does not carry exactly the four questions (found % rows)', v; end if;

  -- The Wispr row reads back the four answers, in both places.
  select count(*) into v from public.portal_items
   where week_id = 1 and published and title = 'Wispr your North Star into your Business Hub'
     and body like '%read your 4 answers from your paper%'
     and body like '%read out your 4 answers%'
     and body not like '%Q4 and Q1 goals%';
  if v <> 1 then raise exception 'the Wispr row still asks for the Q4 and Q1 goals (found % rows)', v; end if;

  -- The audit prompt is in a box, whole: the marker above it, the first
  -- line of the prompt under the marker, and the last line of the row still
  -- the paste marker, so nothing was cut off the end.
  select count(*) into v from public.portal_items
   where week_id = 1 and published and title = 'Run your Time Rich Audit'
     and body like '%= Copy: Your audit prompt' || chr(10) || 'Run a Time Rich Audit on my last week.%'
     and body like '%My last week:'
     and body like 'Paste your 2-minute voice note%'
     and position('= Copy:' in body) > 1;
  if v <> 1 then raise exception 'the audit prompt is not in a copy box (found % rows)', v; end if;

  -- One box, not two: a second marker would split the prompt in half.
  select count(*) into v from public.portal_items
   where week_id = 1 and published and title = 'Run your Time Rich Audit'
     and (length(body) - length(replace(body, '= Copy:', ''))) / length('= Copy:') <> 1;
  if v <> 0 then raise exception 'the audit row has more than one copy marker'; end if;

  -- The old name is gone, or the row answers to two things at once.
  select count(*) into v from public.portal_items
   where week_id = 0 and title = 'Say hello in #introductions';
  if v <> 0 then raise exception 'the #introductions row still has its old title'; end if;

  -- Step 6 is there, once, with its link and the whole of Ella's text.
  select count(*) into v from public.portal_items
   where week_id = 0 and published and sort = 610
     and title = 'Sign up to LaunchLemonade (3 months free)'
     and kind = 'link'
     and url = 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL'
     and body like 'Before Wednesday''s live build session with Multi LLM & Setting Up Your Harness:%'
     and body like '%1. Sign up to LaunchLemonade (3 months free) using the button below.%'
     and body like '%wilfredsoriaga@launchlemonade.app%'
     and body not like '%' || chr(13) || '%';
  if v <> 1 then raise exception 'the LaunchLemonade step is missing or wrong (found % rows)', v; end if;

  select count(*) into v from public.portal_items
   where week_id = 0 and title = 'Sign up to LaunchLemonade (3 months free)';
  if v <> 1 then raise exception 'there are % LaunchLemonade rows, expected 1', v; end if;

  -- And no old voucher anywhere.
  select count(*) into v from public.portal_items
   where url like '%launchlemonade.app%'
     and url <> 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL';
  if v <> 0 then raise exception '% rows still point at the old LaunchLemonade voucher', v; end if;

  -- The Business Hub row: the instructions it always had, the line about
  -- where prompts run, and the connectors drop-down under them. The "+ "
  -- has to be at the start of its own line or the portal draws it as copy
  -- rather than opening a drop-down.
  select count(*) into v from public.portal_items
   where week_id = 0 and published and title = 'Create your Business Hub'
     and sort = 430
     and body like 'In Claude, open Projects, press New project and name it Business Hub.%'
     and body like '%Every prompt in the accelerator runs in a chat inside your Business Hub.%'
     and body like '%' || chr(10) || '+ How to add your connectors' || chr(10) || '1. In Claude, open Settings, then Connectors.%'
     and body like '%5. Test it: ask "What''s on my calendar this week?"%'
     and body like '%Nothing sends, posts or deletes without your yes.'
     and body not like '%' || chr(13) || '%';
  if v <> 1 then raise exception 'the Business Hub row is missing its connectors drop-down (found % rows)', v; end if;

  -- And no carriage returns left in any of them, or the copy box in the
  -- first row never opens: the marker line would read "= Copy: Your intro\r".
  select count(*) into v from public.portal_items
   where published and week_id in (0, 1)
     and title in ('Introduce yourself in #introductions',
                   'Write your North Star on paper',
                   'Wispr your North Star into your Business Hub',
                   'Run your Time Rich Audit')
     and body like '%' || chr(13) || '%';
  if v <> 0 then raise exception '% of the four rows still have carriage returns in them', v; end if;

  -- The house rules for copy in the portal: no arrows, no long dashes, no
  -- square brackets, nothing left marked TBC.
  select count(*) into v from public.portal_items
   where published and week_id in (0, 1)
     and title in ('Introduce yourself in #introductions',
                   'Write your North Star on paper',
                   'Wispr your North Star into your Business Hub',
                   'Run your Time Rich Audit')
     and (coalesce(body, '') || title) ~ '(→|—|–|\[|\]|TBC)';
  if v <> 0 then raise exception '% of the three rows have an arrow, a long dash, brackets or TBC', v; end if;
end
$$;

commit;

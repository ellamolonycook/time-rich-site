-- =====================================================================
-- Curriculum: Start here in five steps (24 Oct).
--
-- Feedback on the 23 Oct build: twenty steps was too many, every step
-- said too much, the call to action was hard to find, and adding the
-- sessions to your calendar is not a setup step. So:
--
--   sort  1-99   pinned at the top of the page, not a step: Ella's
--                welcome and Add every session to your calendar
--   sort 100s    Step 1  Join the Club Slack
--   sort 200s    Step 2  Set up your AI
--   sort 300s    Step 3  Install Wispr Flow
--   sort 400s    Step 4  Build your Business COMPASS
--   sort 500s    Step 5  Before Monday
--
-- curriculum.html groups rows by the hundreds digit of sort and names
-- each step itself (STEPS). Three short tasks a step, one button each.
-- In a body, a line starting "+ " opens a small drop-down named by the
-- rest of that line, holding everything after it up to the next "+ "
-- line: the Slack channels and the Club Code live there.
--
-- The six "Say it" rows are one task now, Fill it in by voice, because
-- the COMPASS is one process. They come off the page (kept, not
-- deleted). Every other row that stays is matched on week and title and
-- rewritten in place, so its id and the member's tick survive. Week 1 is
-- not touched. Safe to run more than once.
-- =====================================================================

begin;

create temp table want (
  week_id integer, kind text, title text, sort integer, body text, url text
) on commit drop;

insert into want (week_id, kind, title, sort, body, url) values
  -- pinned
  (0, $tr$text$tr$, $tr$Welcome to the Superhuman Accelerator$tr$, 10,
   $tr$You're not here just to learn AI. You're here for an outcome: more revenue, more visibility, a system that runs.

Over the next 4 weeks you'll build one real part of your business on AI, live, with industry experts and founders who are in the trenches with you. A new week opens here every Monday.

I'm grateful you're here, and I'll do everything I can to make sure you leave superhuman with AI. But the result is up to you. It takes audacious action.

How serious are you about becoming Time Rich?

Let's lock-in & crush Q4.

Chief Energy Officer,
Ella Molony Cook$tr$,
   null),
  (0, $tr$link$tr$, $tr$Add every session to your calendar$tr$, 20,
   $tr$All 9 live sessions at 12pm ET, in your time zone, with the Zoom link inside.$tr$,
   $tr$https://www.addevent.com/calendar/z0j4nlqbgt6b$tr$),

  -- Step 1: Join the Club Slack
  (0, $tr$link$tr$, $tr$Join the Time Rich Club Slack$tr$, 110,
   $tr$Use the email you joined the accelerator with.

+ The TRC Club Code
1. Bring the good energy. Be kind, cheer people on, and celebrate the wins, big and small.
2. Give more than you take. Share what worked, answer the question you know, and make the intro.
3. Need help with the portal or program? DM a Time Rich Leader or email emc@timerichclub.com.
4. No spam, self-promotion, selling or demanding vibes. Anyone who does this will be removed from the Club and refunded for the accelerator.$tr$,
   $tr$https://join.slack.com/t/timerichclub/shared_invite/zt-4dry4ppfn-yV~VNRrHW_z3K3AFtbnOJQ$tr$),
  (0, $tr$text$tr$, $tr$Add your photo and name$tr$, 120,
   $tr$Your full name, your headshot, and a title that says what you do and where. By the end of Wednesday 28 October.$tr$,
   null),
  (0, $tr$text$tr$, $tr$Say hello in #introductions$tr$, 130,
   $tr$Who you are, what you sell, and your Q4 North Star with a number. After that, ask in the channel that fits so the right expert sees it.

+ The channels, and who to ask
#introductions
Say hello and share your Q4 North Star with an outcome.
#superhuman-accelerator
Announcements, session links and the week's Audacious Action.
#audacious-wins
Post every win, big or small!!!
#ai-setup
Getting your tools installed, connected and talking to each other.
#ai-systems
Share and refine the agents and workflows running your business.
#authority-storytelling-gtm
Storytelling, positioning and getting your offer to market.$tr$,
   null),

  -- Step 2: Set up your AI
  (0, $tr$text$tr$, $tr$Get a paid AI plan and the desktop app$tr$, 210,
   $tr$Claude Pro, ChatGPT Plus or a Google AI plan, around $20 USD a month. Install the desktop app and sign in.$tr$,
   null),
  (0, $tr$text$tr$, $tr$Lock down your privacy$tr$, 220,
   $tr$Before you share anything about your business, open Claude's Settings:
1. Privacy: turn off Help improve Claude.
2. Memory: turn off Include sensitive topics in memory.
3. Shared chats and Shared artifacts: set both to Private.$tr$,
   null),
  (0, $tr$text$tr$, $tr$Tell your AI how you work$tr$, 230,
   $tr$In Claude: Settings, General, Personal preferences. In ChatGPT: Settings, Personalization, Custom instructions. Say what your business does and how you want answers: direct, no fluff, ask before assuming.$tr$,
   null),

  -- Step 3: Install Wispr Flow
  (0, $tr$link$tr$, $tr$Install Wispr Flow$tr$, 310,
   $tr$6 months of Wispr Flow Pro are included. Install it on your laptop, then open Settings, Plans and Billing, Add promo code. Enter TIMERICH6, press Apply, then Redeem now. It asks for a card, but you won't be charged for the 6 months.$tr$,
   $tr$https://ref.wisprflow.ai/ella-cook-vt27$tr$),
  (0, $tr$text$tr$, $tr$Turn it on$tr$, 320,
   $tr$Hold fn on Mac (Ctrl + Opt if there's no fn key) or Ctrl + Win on Windows. Speak, let go, and your words appear at your cursor.$tr$,
   null),
  (0, $tr$link$tr$, $tr$Connect your tools to your AI$tr$, 330,
   $tr$In Wispr Flow: Settings, MCP, Add to Claude. Then connect your email, calendar and Notion with the guide. Nothing sends, posts or deletes without your yes.$tr$,
   $tr$https://superhumanos.notion.site/Connect-your-tools-to-your-AI-Superhuman-Accelerator-401ca5ebe557817aaa44ff89de92a091$tr$),

  -- Step 4: Build your Business COMPASS
  (0, $tr$link$tr$, $tr$Make your copy of the Business COMPASS$tr$, 410,
   $tr$Make your own copy and keep it open for the next task.$tr$,
   $tr$https://docs.google.com/document/d/1c50ST_FSASEOCIh1z3GQhkdNl9eqFjY0asvk-MC1X5s/copy$tr$),
  (0, $tr$text$tr$, $tr$Fill it in by voice$tr$, 420,
   $tr$Click under each heading, hold fn and talk. Messy is fine.

+ What to say under each heading
One-liners
What you do, who it's for and the result they get, in one sentence.
Who I serve
Your best customers, the problem keeping them up, and who you turn away.
What I sell
Your offers, what each costs, and the order people buy them in.
My point of view
What most people in your industry get wrong.
Voice
How you sound, how you never sound, and how you sign off.
Current focus
Your 90-day goal with a number, your hours a week, and what you'll stop doing.$tr$,
   null),
  (0, $tr$text$tr$, $tr$Create your Business Hub$tr$, 430,
   $tr$In Claude, open Projects, press New project and name it Business Hub. Paste this into the instructions, then add your COMPASS to the project's Files:

"This is my Business Hub. Read my Business COMPASS in this project's files before any task. If something is missing, ask me before you guess."$tr$,
   null),

  -- Step 5: Before Monday
  (0, $tr$text$tr$, $tr$Record last week in 2 minutes$tr$, 510,
   $tr$Turn on Wispr Flow's notetaker and talk through last week, day by day: what you did and where the hours went. We run your Time Rich Audit on it live on Monday.$tr$,
   null),
  (0, $tr$link$tr$, $tr$Answer the onboarding questions$tr$, 520,
   $tr$They shape the curriculum, your hot seat room and your Club profile.$tr$,
   $tr$https://timerich.ai/superhuman/$tr$),
  (0, $tr$link$tr$, $tr$Join the Superhuman WhatsApp group$tr$, 530,
   $tr$For announcements between sessions.$tr$,
   $tr$https://chat.whatsapp.com/E5GU1dvuHhFDI77yO88OIw?mode=gi_t$tr$);

-- rows that stay: rewritten in place, so their ids and ticks survive
update public.portal_items i
   set kind = w.kind, body = w.body, url = w.url, sort = w.sort, published = true
  from want w
 where i.week_id = w.week_id and i.title = w.title;

-- new rows
insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select w.week_id, w.kind, w.title, w.body, w.url, w.sort, true
  from want w
 where not exists (select 1 from public.portal_items i
                    where i.week_id = w.week_id and i.title = w.title);

-- everything else in Start here comes off the page (kept, not deleted)
update public.portal_items i
   set published = false
 where i.week_id = 0 and i.published
   and not exists (select 1 from want w where w.week_id = i.week_id and w.title = i.title);

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items where week_id = 0 and published;
  if v <> 17 then raise exception 'expected 17 published rows in Start here, found %', v; end if;
  select count(*) into v from public.portal_items where week_id = 0 and published and sort < 100;
  if v <> 2 then raise exception 'expected 2 pinned rows in Start here, found %', v; end if;
  select count(*) into v from (
    select sort / 100 from public.portal_items
     where week_id = 0 and published and sort >= 100
     group by sort / 100 having count(*) = 3) s;
  if v <> 5 then raise exception 'expected 5 steps of 3 tasks in Start here, found % full steps', v; end if;
  select count(*) into v from public.portal_items
   where week_id = 0 and published
     and (coalesce(body, '') || title) ~ '(→|—|–|\[|\]|TBC|wins-gifts)';
  if v <> 0 then raise exception '% published rows still have an arrow, a long dash, brackets, TBC or #wins-gifts', v; end if;
  select count(*) into v from public.portal_items
   where week_id = 0 and published and title = 'Install Wispr Flow'
     and body like '%TIMERICH6%' and url = 'https://ref.wisprflow.ai/ella-cook-vt27';
  if v <> 1 then raise exception 'the Wispr Flow step is missing its code or referral link'; end if;
  select count(*) into v from public.portal_items
   where week_id = 0 and published and title = 'Join the Time Rich Club Slack'
     and url like 'https://join.slack.com/%' and body like '%TRC Club Code%';
  if v <> 1 then raise exception 'the Slack step is missing its link or the Club Code'; end if;
end
$$;

commit;

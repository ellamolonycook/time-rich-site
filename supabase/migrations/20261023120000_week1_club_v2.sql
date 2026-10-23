-- =====================================================================
-- Curriculum: Week 1 in the Club, v2 (approved by Ella to build, 23 Oct).
--
-- Source: "Week 1 in the Club: preview for Ella" (Google Doc, 23 Oct),
-- which carries Ella's own edits to the welcome and the order of Start
-- here, the Slack onboarding with who supports each channel, the TRC Club
-- Code, and Wednesday 28 October with Cien Solon and LaunchLemonade.
--
-- Start here (week 0): sort below 100 is always in view (calendar, Slack,
-- welcome); sort 100 and up sits in the Club's "Preparation work"
-- drop-down (curriculum.html, FOLD_FROM).
--
-- Content only. Nothing is deleted and a row that stays keeps its id, so a
-- member's ticks survive: rows are matched on week and title, rewritten in
-- place, new ones inserted, and any other published row in weeks 0 and 1
-- unpublished. Safe to run more than once.
--
-- Supersedes 20261023090000_week1_open_business_surgery.sql, which never
-- ran.
-- =====================================================================

begin;

create temp table want (
  week_id integer, kind text, title text, sort integer, body text, url text
) on commit drop;

insert into want (week_id, kind, title, sort, body, url) values
  (0, $tr$link$tr$, $tr$Add every session to your calendar$tr$, 10,
   $tr$All 9 live sessions at 12pm ET, in your own time zone, with the Zoom link inside each one.$tr$,
   $tr$https://www.addevent.com/calendar/z0j4nlqbgt6b$tr$),
  (0, $tr$link$tr$, $tr$Join the Time Rich Club Slack$tr$, 20,
   $tr$Slack is where the cohort, the experts and the Time Rich team work together between sessions.

1. Join with the button below, using the email you joined the accelerator with.
2. Add your headshot. Set your display name to your full name, and your title to what you do and your company.
3. Post in #introductions: who you are, what you sell, and your Q4 North Star with a number.
4. Ask in the channel that fits, so the right expert sees it. For anything urgent, tag Time Rich Leader.

Add your photo by the end of Wednesday 28 October, or our team will remind you.

TRC Club Code
1. Bring the good energy. Be kind, cheer people on, and celebrate the wins, big and small.
2. Give more than you take. Share what worked, answer the question you know, and make the intro.
3. Need help with the portal or program? DM a Time Rich Leader or email emc@timerichclub.com. Keep the main channels for building and connecting.

The channels, and who supports each one:

#superhuman-accelerator
Announcements, session links and the week's Audacious Action. Posted by Ella and the Time Rich team.

#introductions
Say hello, plus your Q4 North Star with a number. Ella welcomes everyone here.

#audacious-wins
Every win, big or small. Ella and the whole cohort.

#ai-support
Prompts, projects and agents. Jo O'Kelly (Results2Go), Shikshita Juyal (Crework Labs), Indra Klavins (People Process Things), Thiers Santos and the 99x engineers, and Cien Solon and Wilfred Soriaga (LaunchLemonade).

#technical-support
The Club, Wispr Flow, connectors and logins. Time Rich Leader, our support team.

#content-system
The Content System and Stanley, your Head of AI Content. Mika Reyes and the Stanley team.

#authority-storytelling-gtm
Posts, talks and go-to-market. ViKA Victoria (Brave New Story).$tr$,
   $tr$https://join.slack.com/t/timerichclub/shared_invite/zt-4dry4ppfn-yV~VNRrHW_z3K3AFtbnOJQ$tr$),
  (0, $tr$link$tr$, $tr$Welcome to the Superhuman Accelerator$tr$, 30,
   $tr$You're not here just to learn AI. You're here for an outcome: more revenue, more visibility, a system that runs.

Over the next 4 weeks you'll build one real part of your business on AI, live, with industry experts and founders who are in the trenches with you. A new week opens here every Monday.

I'm grateful you're here, and I'll do everything I can to make sure you leave superhuman with AI. But the result is up to you. It takes audacious action.

How serious are you about becoming Time Rich?

Let's lock-in & crush Q4.

Chief Energy Officer,
Ella Molony Cook$tr$,
   $tr$https://www.linkedin.com/in/ellamolonycook/$tr$),
  (0, $tr$text$tr$, $tr$Get a paid AI plan and the desktop app$tr$, 110,
   $tr$Sign up for a paid plan of the AI you'll use: Claude Pro, ChatGPT Plus or a Google AI plan, around $20 USD a month. Install the desktop app and sign in.$tr$,
   null),
  (0, $tr$text$tr$, $tr$Lock down your privacy$tr$, 120,
   $tr$Before you give your AI any business information, open Claude's Settings and change three things:

1. Privacy: turn off Help improve Claude.
2. Memory: turn off Include sensitive topics in memory.
3. Privacy, then Shared chats and Shared artifacts: set both to Private.$tr$,
   null),
  (0, $tr$text$tr$, $tr$Tell your AI how you work$tr$, 130,
   $tr$Open your personal preferences. In Claude it's Settings, then General, then Personal preferences. In ChatGPT it's Settings, then Personalization, then Custom instructions.

Say where you are, what your business does, and how you want answers: direct, no fluff, ask before assuming.$tr$,
   null),
  (0, $tr$link$tr$, $tr$Install Wispr Flow$tr$, 140,
   $tr$Your accelerator includes 6 months of Wispr Flow Pro. Install it on your laptop: the code only works in the desktop app.

In the app, open Settings, then Plans and Billing, then Add promo code at the bottom. Enter TIMERICH6, press Apply, then Redeem now. Wispr asks for a card, but you won't be charged for the 6 months.$tr$,
   $tr$https://ref.wisprflow.ai/ella-cook-vt27$tr$),
  (0, $tr$text$tr$, $tr$Turn it on$tr$, 150,
   $tr$Hold fn on Mac (Ctrl + Opt if your Mac has no fn key) or Ctrl + Win on Windows. Speak, then let go. Your words appear wherever your cursor is.

For long answers, press fn + Space (Windows: Ctrl + Win + Space) to go hands-free, and press it again to stop.$tr$,
   null),
  (0, $tr$link$tr$, $tr$Connect your tools to your AI$tr$, 160,
   $tr$In Wispr Flow, open Settings, then MCP, and add it to Claude. Then connect your email, calendar and Notion with the guide.

Nothing in this program sends, posts or deletes anything without your yes, and you can disconnect a tool at any time.$tr$,
   $tr$https://superhumanos.notion.site/Connect-your-tools-to-your-AI-Superhuman-Accelerator-401ca5ebe557817aaa44ff89de92a091$tr$),
  (0, $tr$text$tr$, $tr$Record last week in 2 minutes$tr$, 170,
   $tr$Turn on Wispr Flow's notetaker and talk for 2 minutes about last week, day by day: what you did and where the hours went. Save it somewhere you can paste from. We run the Time Rich Audit on it live on Monday.$tr$,
   null),
  (0, $tr$text$tr$, $tr$Create your Business Hub$tr$, 180,
   $tr$In Claude, open Projects, press New project and name it Business Hub. Paste this into the project instructions:

"This is my Business Hub. Read my Business COMPASS in this project's files before any task. If something is missing, ask me before you guess."

Once your COMPASS is filled in, add it to the project's Files: add it from Google Drive, or paste it in.$tr$,
   null),
  (0, $tr$link$tr$, $tr$Make your copy of the Business COMPASS$tr$, 190,
   $tr$Make your own copy and keep it open: the voice prompts below fill it in.$tr$,
   $tr$https://docs.google.com/document/d/1c50ST_FSASEOCIh1z3GQhkdNl9eqFjY0asvk-MC1X5s/copy$tr$),
  (0, $tr$text$tr$, $tr$Say it: One-liners$tr$, 200,
   $tr$Click into your COMPASS under 1. One-liners, hold fn and say: "What I do, who it's for and the result they get, in one sentence, the way I'd say it on a call."$tr$,
   null),
  (0, $tr$text$tr$, $tr$Say it: Who I serve$tr$, 210,
   $tr$Click into your COMPASS under 2. Who I serve, hold fn and say: "My best customers are… the problem keeping them up is… the people I turn away are…"$tr$,
   null),
  (0, $tr$text$tr$, $tr$Say it: What I sell$tr$, 220,
   $tr$Click into your COMPASS under 3. What I sell, hold fn and say: "My offers are… each one costs… and people usually buy them in this order…"$tr$,
   null),
  (0, $tr$text$tr$, $tr$Say it: My point of view$tr$, 230,
   $tr$Click into your COMPASS under 4. My point of view, hold fn and say: "What I believe that most people in my industry get wrong is…"$tr$,
   null),
  (0, $tr$text$tr$, $tr$Say it: Voice$tr$, 240,
   $tr$Click into your COMPASS under 6. Voice, hold fn and say: "When I write, I sound like… I never sound like… I always sign off with…"$tr$,
   null),
  (0, $tr$text$tr$, $tr$Say it: Current focus$tr$, 250,
   $tr$Click into your COMPASS under 9. Current focus, hold fn and say: "In 90 days I want… a number and a date. I have this many hours a week. I'll stop doing…"$tr$,
   null),
  (0, $tr$link$tr$, $tr$Answer the onboarding questions$tr$, 260,
   $tr$Your answers shape the curriculum, your hot seat room and your profile in the Time Rich Club.$tr$,
   $tr$https://timerich.ai/superhuman/$tr$),
  (0, $tr$link$tr$, $tr$Join the Superhuman WhatsApp group$tr$, 270,
   $tr$For announcements between sessions. We accept everyone into the group on Saturday 24 October at 12pm ET.$tr$,
   $tr$https://chat.whatsapp.com/E5GU1dvuHhFDI77yO88OIw?mode=gi_t$tr$),
  (1, $tr$text$tr$, $tr$This week: your photo and the TRC Club Code$tr$, 5,
   $tr$Add your photo to your Slack profile by the end of Wednesday 28 October, or our team will remind you.

TRC Club Code
1. Bring the good energy. Be kind, cheer people on, and celebrate the wins, big and small.
2. Give more than you take. Share what worked, answer the question you know, and make the intro.
3. Need help with the portal or program? DM a Time Rich Leader or email emc@timerichclub.com. Keep the main channels for building and connecting.$tr$,
   null),
  (1, $tr$text$tr$, $tr$Monday 26 October: Open Business Surgery$tr$, 10,
   $tr$Live at 12pm ET on Zoom. Bring a pen and paper.

One project only today: your Business Hub. Every prompt below runs in a chat inside it. Speak your answers with Wispr Flow. If Wispr isn't working on the day, type them and fix it after the call.$tr$,
   null),
  (1, $tr$text$tr$, $tr$Write your North Star on paper$tr$, 20,
   $tr$Before you open any AI, write by hand:

1. Q4 North Star: one result by 31 December, with a number.
2. Q1 North Star: one result by 31 March, with a number.
3. The highest value use of your time that is non-negotiable for your business. For example: sales calls with new clients, because nobody else can do them yet.
4. What you'll stop doing to make room for it.
5. Hours a week you'll give this.

Then ask yourself: if this was the only thing you achieved this quarter, would it be enough?$tr$,
   null),
  (1, $tr$text$tr$, $tr$Wispr your North Star into your Business Hub$tr$, 30,
   $tr$Open a new chat in your Business Hub, paste this, then hold your Wispr key and read your Q4 and Q1 goals from your paper:

Here is my North Star: (read out your Q4 and Q1 goals).

Play each one back to me in one line. Tell me if each has a number and a date. Then ask me the one question that would make it sharper. Keep it, because every prompt after this works towards it.$tr$,
   null),
  (1, $tr$text$tr$, $tr$Run your Time Rich Audit$tr$, 40,
   $tr$Paste your 2-minute voice note of last week (or your calendar) at the end of this prompt, in your Business Hub. You get your revenue number and your first 3 hand-offs.

Run a Time Rich Audit on my last week. Read my Business COMPASS first if it's in this project. If it's missing or empty, ask me the 3 questions you need before you start.

1. List every task over 15 minutes with its hours.
2. Mark a task $ only if it put me in front of someone who can pay me this month AND it sells one of my offers. Prep, admin and coffee with no ask are not $.
3. Give me my revenue number: the percentage of my hours that were $ tasks.
4. Give every non-$ task one owner: Skill (same steps every time), Agent (recurring, on a schedule or trigger), Human (needs hands or teachable judgment), or Me. Only mark Me if it's pricing, anything sent in my name, brand direction or hiring.
5. Name the 3 hand-offs that return the most hours this week. Write each as a 4 Cs brief: Clarity (what done looks like), Context (what's in my head), Collaboration (who's involved, where I check), Cadence (one-off or recurring, when it's due).

Don't invent tasks, hours or offers. If something is missing, ask me before you guess.

My last week:$tr$,
   null),
  (1, $tr$link$tr$, $tr$Take one Audacious Action this week$tr$, 50,
   $tr$Your first agent goes where the money is. Open the 10 growth prompts, pick ONE, run it in your Business Hub before Friday, and post what you did in #audacious-wins in the Time Rich Club Slack.

The prompts: know exactly who you sell to, Boardy (your AI superconnector), your warmest people in one list, never let a lead go quiet, a voice note instead of another email, give first, your partnerships strategy, get your name in the room, analyse your last sales call, and check your cashflow.$tr$,
   $tr$https://superhumanos.notion.site/Audacious-Action-10-growth-prompts-Week-1-402ca5ebe55781b4a146dabc508ede72$tr$),
  (1, $tr$text$tr$, $tr$Audacious Action before Friday: finish your Business Hub$tr$, 60,
   $tr$1. If you haven't yet, create the Business Hub project (Start here has the steps).
2. Connect your tools: Wispr Flow (Settings, then MCP, then Add to Claude), then in Claude's Settings, open Connectors and add Notion, Gmail and Google Calendar.
3. Fill in your Business COMPASS by voice, then add it to your Business Hub's Files: from Google Drive, or paste it in.
4. Test it with your voice:

Read my Business COMPASS. Tell me in three lines what you know about my business, and the one thing that's missing.

Then run the Audacious Action you picked, and post it in #audacious-wins.$tr$,
   null),
  (1, $tr$link$tr$, $tr$Wednesday 28 October: Meet Cien Solon and set up LaunchLemonade$tr$, 70,
   $tr$Bonus session, live at 12pm ET on Zoom: Multi-LLM and setting your harness.

Cien Solon is the co-founder and CEO of LaunchLemonade, a platform that helps businesses build and manage AI teammates securely. She has 11 years across technology, product and growth, has led engineering teams of up to 100, and mentors founders through Techstars and the British Library.

What LaunchLemonade is: a place to build AI agents that do the work for you, using more than one AI model. It isn't a chat window you type prompts into. It's only for agents.

Your accelerator includes 3 months free. Come to the call with it set up, so you can build along with Cien:

1. Sign up with the button below. Your 3 months are included in the link.
2. Log in once before Wednesday, so you're ready to build.
3. Stuck? Email Wilfred Soriaga at LaunchLemonade support: wilfredsoriaga@launchlemonade.app$tr$,
   $tr$https://studio.launchlemonade.app/signup?voucher=ACCELERATOR$tr$);

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

-- everything else in weeks 0 and 1 comes off the page (kept, not deleted)
update public.portal_items i
   set published = false
 where i.week_id in (0, 1) and i.published
   and not exists (select 1 from want w where w.week_id = i.week_id and w.title = i.title);

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items where week_id = 0 and published;
  if v <> 20 then raise exception 'expected 20 published rows in Start here, found %', v; end if;
  select count(*) into v from public.portal_items where week_id = 1 and published;
  if v <> 8 then raise exception 'expected 8 published rows in Week 1, found %', v; end if;
  select count(*) into v from public.portal_items
   where week_id in (0, 1) and published
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
  select count(*) into v from public.portal_items
   where week_id = 1 and published and url like '%launchlemonade.app/signup?voucher=ACCELERATOR';
  if v <> 1 then raise exception 'the Wednesday LaunchLemonade step is missing its link'; end if;
end
$$;

commit;

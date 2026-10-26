-- =====================================================================
-- Curriculum: Week 1 in the order a member does it, rewritten for an
-- early-stage founder (26 Oct).
--
-- Week 1 opened today, and the panel read out of order: the week's own
-- lessons came first and the setup sat under them, so "Wispr your North
-- Star into your Business Hub" asked for a Hub the member had not been
-- shown how to make yet. Two rows also repeated the setup under another
-- name. curriculum.html now draws the setup first while any of it is
-- left; this migration fixes the content to match.
--
-- It is Monday now, so nothing says "Before Monday", and building the
-- Business COMPASS is part of the week rather than pre-work: it comes
-- after the North Star, which feeds its Current focus, and before the
-- Time Rich Audit, which reads it.
--
-- Every row is rewritten for a founder who may be solo, pre-revenue and
-- new to AI: each says why it matters, the jargon is explained where it
-- appears, and the prompts work without customers or a team yet. Ella's
-- welcome letter is not touched.
--
-- Start here (the setup), in five steps:
--   100s  Step 1  Join the Club Slack. "Say hello in #introductions" is
--                 now "Introduce yourself in the Club", with the six-point
--                 template in a copy box.
--   200s  Step 2  Set up your AI
--   300s  Step 3  Install Wispr Flow
--   400s  Step 4  Build your Business Hub: create it click by click,
--                 paste in its rules, check it works. Create your Business
--                 Hub moved here from the COMPASS step, because this
--                 week's prompts run inside the Hub.
--   500s  Step 5  Get ready for the week (was Before Monday)
--
-- Week 1, in the order of the week, with the build-it-yourself lessons
-- at the end:
--    5  Your master prompt                             (new: copy it, then the AI sets up xx and the other shortcuts)
--   10  Open Business Surgery
--   20  Write your North Star on paper
--   30  Wispr your North Star into your Business Hub   (copy the prompt)
--   40  Build your Business COMPASS                    (was Start here)
--   44  Build your ICP from your calls                 (new, Business Hub doc)
--   50  Run your Time Rich Audit                       (copy the prompt)
--   60  Pick your personal AI agent                    (the page draws the shared agent table in it)
--   70  Preparation: Multi-LLM & Setting Your Harness  (was Wednesday 28 October: Meet Cien Solon ...)
--   80  10 Growth Prompts                              (was Take one Audacious Action; the page draws the ten prompts in it)
--   90  Set up your first three Time Rich Agents       (new: setup for Claude, ChatGPT and Gemini)
--   94  Build your next Time Rich Agent                (new, Business Hub doc)
--   98  Give your AI your voice                        (new: voice prompt, then a skill)
--
-- Renamed rows keep their ids and ticks: "Make your copy of the Business
-- COMPASS" moves into Week 1 as "Build your Business COMPASS", and "Say
-- hello in #introductions" becomes "Introduce yourself in the Club".
-- Off the page (kept, not deleted):
--   "Fill it in by voice"  -- folded into Build your Business COMPASS.
--   "This week: your photo and the TRC Club Code"  -- Step 1 already
--     asks for the photo and carries the Club Code.
--   "Audacious Action before Friday: finish your Business Hub" -- the
--     setup again, and a second "Audacious Action" beside the real one.
--
-- Text the member pastes sits in a copy box: in a body, a line "= Name"
-- opens one, named by the rest of the line, and a line that is only "="
-- (or the next "= " or "+ " line, or the end) closes it. Rows that point
-- at Claude get a button that opens it.
--
-- Replaces 20261025200000_week1_intro_north_star.sql (Gideon's 25 Oct
-- batch), which is not to be run: every row that file rewrites is written
-- here in full, so this one stands on its own. If it did run first, this
-- still works on top of it -- its "Introduce yourself in #introductions"
-- row is renamed here, and its LaunchLemonade step 6 comes off the page
-- because the Preparation lesson carries the same steps in Ella's words.
-- Every LaunchLemonade link is moved to the TIMERICHLL voucher here too.
-- The audit table, the agent comparison and the ten growth prompts are
-- markup in curriculum.html, drawn inside the lessons of the same name.
--
-- Rows are matched on week and title and rewritten in place. Safe to run
-- more than once.
-- =====================================================================

begin;

-- renames first, so the rows keep their ids and the member's tick
update public.portal_items
   set week_id = 1, title = 'Build your Business COMPASS'
 where week_id = 0 and title = 'Make your copy of the Business COMPASS'
   and not exists (select 1 from public.portal_items
                    where week_id = 1 and title = 'Build your Business COMPASS');
update public.portal_items
   set title = 'Make sure you introduce yourself'
 where week_id = 0 and title = 'Say hello in #introductions'
   and not exists (select 1 from public.portal_items
                    where week_id = 0 and title = 'Make sure you introduce yourself');
update public.portal_items
   set title = 'Make sure you introduce yourself'
 where week_id = 0 and title = 'Introduce yourself in #introductions'
   and not exists (select 1 from public.portal_items
                    where week_id = 0 and title = 'Make sure you introduce yourself');
update public.portal_items
   set title = 'TRC Slack'
 where week_id = 0 and title = 'Join the Time Rich Club Slack'
   and not exists (select 1 from public.portal_items
                    where week_id = 0 and title = 'TRC Slack');
update public.portal_items
   set title = 'Open Business Surgery'
 where week_id = 1 and title = 'Monday 26 October: Open Business Surgery'
   and not exists (select 1 from public.portal_items
                    where week_id = 1 and title = 'Open Business Surgery');

update public.portal_items
   set title = 'Preparation: Multi-LLM & Setting Your Harness'
 where week_id = 1 and title = 'Wednesday 28 October: Meet Cien Solon and set up LaunchLemonade'
   and not exists (select 1 from public.portal_items
                    where week_id = 1 and title = 'Preparation: Multi-LLM & Setting Your Harness');
update public.portal_items
   set title = '10 Growth Prompts'
 where week_id = 1 and title = 'Take one Audacious Action this week'
   and not exists (select 1 from public.portal_items
                    where week_id = 1 and title = '10 Growth Prompts');

-- one LaunchLemonade offer, wherever the link is: the TIMERICHLL voucher
update public.portal_items
   set url = 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL'
 where url like '%launchlemonade.app%'
   and url <> 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL';

update public.portal_weeks
   set summary = 'Set one goal with a number, see where your hours really go, and build the Business Hub every prompt runs in. On Friday, train your first agent on what it now knows about you.'
 where id = 1;

create temp table want (
  week_id integer, kind text, title text, sort integer, body text, url text
) on commit drop;

insert into want (week_id, kind, title, sort, body, url) values
  -- ---- Start here, Step 1: Join the Club Slack ----------------------
  (0, $tr$link$tr$, $tr$TRC Slack$tr$, 110,
   $tr$Sign up with the email you joined the accelerator with. This is where the other founders, the experts and our team are all week, so ask here first when you're stuck.

+ The TRC Club Code
1. Bring good energy. Be kind, cheer people on, and celebrate the wins, big and small.
2. Give more than you take. Share what worked, answer the question you know, and make the intro.
3. Need help with the portal or program? DM a Time Rich Leader or email emc@timerichclub.com.
4. No spam, self-promotion, selling or demanding vibes. Anyone who does this will be removed from the Club and refunded for the accelerator.$tr$,
   $tr$https://join.slack.com/t/timerichclub/shared_invite/zt-4dry4ppfn-yV~VNRrHW_z3K3AFtbnOJQ$tr$),
  (0, $tr$text$tr$, $tr$Add your photo and name$tr$, 120,
   $tr$Your full name, a clear headshot, and a title that says what you do. People reply to a face, and this room is full of founders who can open doors for you. Do it by the end of Wednesday 28 October.$tr$,
   null),
  (0, $tr$text$tr$, $tr$Make sure you introduce yourself$tr$, 130,
   $tr$Post it in #introductions. Press Copy, paste it into the message box (Cmd+V on Mac, Ctrl+V on Windows), replace each point with your answer and press send.

= Copy the template
• Name, company, city. Where you’re based.
• What your business does. The problem you solve, in one sentence.
• Your Q4 North Star. One target, with a number and a date. Example: “3 new retainer clients by 31 December.”
• Your superpower. What you can help the other founders with.
• What you’re most excited about in the accelerator.
• LinkedIn. Full link, so people can connect.
=
After that, ask in the channel that fits, so the right expert sees it.

+ The channels, and where to ask
#introductions
Say hello and share your Q4 North Star with a number.
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

  -- ---- Start here, Step 2: Set up your AI ---------------------------
  (0, $tr$link$tr$, $tr$Get a paid AI plan and the desktop app$tr$, 210,
   $tr$Claude Pro, ChatGPT Plus or a Google AI plan, around $20 USD a month. Every step on this page shows Claude, so it's the easiest to follow along with. Install the desktop app rather than using a browser tab: it's the version Wispr Flow and your other tools connect to. Then sign in.

New to AI? Open the drop-down below first, and every step after this will make more sense.

+ New to AI? Seven words you'll hear this week
Prompt
What you type or say to the AI. Plain and specific beats clever. Say who it's for, what you want and what good looks like.
Chat
One conversation. Start a new chat for each new task, so the AI doesn't mix them up.
Project
A folder in Claude with its own instructions and files. Every chat inside it already knows your business.
Context
What the AI knows about you before it answers. The more it knows, the less it guesses.
Agent
An AI that does a job for you on its own, like sorting your inbox, and checks with you before anything goes out.
MCP
The connection that lets Claude use your other apps, like Wispr Flow, your email and your calendar.
Skill
A how-to your AI saves and uses on its own whenever a task needs it, like rewriting a draft in your voice. You build it once instead of pasting the same prompt every time.

Three tips
When an answer is off, don't start over. Tell it what's wrong in plain words, like you would a new hire, and ask again.
AI can sound sure and still be wrong. Check any number, name or date before you use it.
Stuck on setup? Ask in #ai-setup in the Club Slack. Someone has hit the same wall.$tr$,
   $tr$https://claude.ai/download$tr$),
  (0, $tr$link$tr$, $tr$Lock down your privacy$tr$, 220,
   $tr$Do this before you tell your AI anything about your business or your clients. In Claude's Settings:
1. Privacy: turn off Help improve Claude.
2. Memory: turn off Include sensitive topics in memory.
3. Shared chats and Shared artifacts: set both to Private.$tr$,
   $tr$https://claude.ai/settings$tr$),
  (0, $tr$link$tr$, $tr$Tell your AI how you work$tr$, 230,
   $tr$Your AI reads this before every answer, so you stop repeating yourself. In Claude: Settings, General, Personal preferences. In ChatGPT: Settings, Personalization, Custom instructions. Copy this in and change the first line to fit you.

= Copy your preferences
I run (your business) for (who you serve). I'm a founder with very little time, so give me direct answers with no fluff. Ask before you assume anything about my business, and tell me when you're not sure.$tr$,
   $tr$https://claude.ai/settings$tr$),
  -- ---- Start here, Step 3: Install Wispr Flow -----------------------
  (0, $tr$link$tr$, $tr$Install Wispr Flow$tr$, 310,
   $tr$Wispr Flow turns your voice into text anywhere on your laptop. You'll talk most of this week instead of typing. 6 months of Wispr Flow Pro are included: install it, then open Settings, Plans and Billing, Add promo code. Enter TIMERICH6, press Apply, then Redeem now. It asks for a card, but you won't be charged for the 6 months.$tr$,
   $tr$https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6$tr$),
  (0, $tr$text$tr$, $tr$Turn it on$tr$, 320,
   $tr$Hold fn on Mac (Ctrl + Opt if there's no fn key) or Ctrl + Win on Windows. Speak, let go, and your words appear at your cursor. For longer answers, double-tap fn on Mac to talk hands-free, and tap fn again to stop. Try it now: say your Q4 goal out loud into any text box.$tr$,
   null),
  (0, $tr$link$tr$, $tr$Connect your tools to your AI$tr$, 330,
   $tr$This lets Claude read your email, calendar and files, so it answers with your real week instead of a guess. Your agents need these connections later this week. In Wispr Flow: Settings, MCP, Add to Claude. Then in Claude: Settings, Connectors, and connect what you use. The guide walks you through each one. Nothing sends, posts or deletes without your yes.

+ What to connect
☐ Google Drive
☐ Gmail (or Outlook)
☐ Google Calendar (or Outlook Calendar)
☐ Slack
☐ Notion
☐ Your CRM, if you use one (HubSpot, Pipedrive, Attio)$tr$,
   $tr$https://superhumanos.notion.site/Connect-your-tools-to-your-AI-Superhuman-Accelerator-401ca5ebe557817aaa44ff89de92a091$tr$),

  -- ---- Start here, Step 4: Build your Business Hub ------------------
  (0, $tr$link$tr$, $tr$Create your Business Hub$tr$, 410,
   $tr$Your Business Hub is one project in your AI tool that knows your business. Every chat inside it reads the same instructions and files, so you never explain your business from scratch again. Every prompt this week runs in it.

In the Claude desktop app:
1. Click Projects in the left sidebar.
2. Click New project.
3. Name it exactly Business Hub. You can skip the description.
4. Click Create project.

You land on the project page: your chats on the left, Instructions and Files on the right. Keep it open for the next task.

+ Using ChatGPT or Gemini instead?
ChatGPT
In the sidebar, click New project, name it Business Hub and create it. Its instructions and files are on the project page.
Gemini
Open Gems, click New Gem and name it Business Hub. It has its own Instructions box, and a Knowledge section for files.$tr$,
   $tr$https://claude.ai/projects$tr$),
  (0, $tr$text$tr$, $tr$Paste in your Hub's rules$tr$, 420,
   $tr$These tell your Hub how to work with you: read your COMPASS first, never guess, and never send anything without your yes.
1. On the Business Hub page, click Instructions on the right. It may say Set project instructions.
2. Press Copy below, paste it into the box and click Save.

= Copy the instructions
This is my Business Hub. Read my Business COMPASS in this project's files before any task. Everything we build here gets saved as a doc in my Google Drive, not left in the chat.

House rules:
- Assess my goal and point out where it falls short.
- Ask clarifying questions before you start.
- Act on small, reversible tasks. Ask before anything that goes out in my name.
- Never invent numbers, quotes, names or sources. Say "I don't know" instead.
- Never send, post, buy or delete without my yes.
- Push back when my plan has a gap. Tell me before you tell me it's good.
- Before you finish, check your work against my brief and say what you checked.
- Rate your work out of 10, and be brutally honest.

Honesty rules:
1. If you don't know, say so. Never fill a gap with a guess. Name your source for every fact or number so I can check it.
2. Before you tell me an idea is good, give me the strongest objection a sceptical investor would raise.
3. For any decision, argue the opposite of your first answer as hard as you can, then tell me which side the evidence supports.
=
Your COMPASS isn't in the Hub yet. You build it this week, add it to the Hub's Files, and it reads it from then on.

+ Your Business Hub checklist
☐ Project created and named exactly Business Hub
☐ Rules pasted and saved
☐ Tools connected (Step 3)
☐ Business COMPASS filled in and added to Files (this week)
☐ Three scheduled agents running (this week)
☐ Tested with a real question
Once a month, update your COMPASS goal, offers and priorities.$tr$,
   null),
  (0, $tr$link$tr$, $tr$Check your Hub works$tr$, 430,
   $tr$Start a chat from inside the project: type in the box on the Business Hub page, not on Claude's home screen. Chats you start there show up in the Hub's list.

= Copy the test prompt
What are your instructions in this project? Tell me in three lines how you'll work with me.
=
If it plays back your rules, your Hub is ready. If it doesn't know them, check you clicked Save and that the chat sits inside Business Hub.

Then test your connectors: press the + button in the message box, check they're switched on, and ask "What's on my calendar this week?"$tr$,
   $tr$https://claude.ai/projects$tr$),

  -- ---- Start here, Step 5: Get ready for the week -------------------
  (0, $tr$text$tr$, $tr$Record last week in 2 minutes$tr$, 510,
   $tr$Turn on Wispr Flow's notetaker and talk through last week, day by day: what you did and where the hours went. Rough is fine, and honest is better than impressive: the AI can only find hours you tell it about. You'll paste it into your Time Rich Audit this week.$tr$,
   null),
  (0, $tr$link$tr$, $tr$Answer the onboarding questions$tr$, 520,
   $tr$Your answers shape the curriculum, your hot seat room and your Club profile.$tr$,
   $tr$https://timerich.ai/superhuman/$tr$),
  (0, $tr$link$tr$, $tr$Join the Superhuman WhatsApp group$tr$, 530,
   $tr$For announcements between sessions, straight to your phone.$tr$,
   $tr$https://chat.whatsapp.com/E5GU1dvuHhFDI77yO88OIw?mode=gi_t$tr$),

  -- ---- Week 1, in the order of the week -----------------------------
  (1, $tr$text$tr$, $tr$Your master prompt$tr$, 5,
   $tr$Add this to the end of any prompt and your AI checks its own work: it asks before it guesses, rates itself out of 10 and pushes back on you. Once your AI has set it up as a shortcut, you type xx anywhere and it appears.

= Copy the master prompt
Before you start:
- Restate my goal in one line, and tell me if it's the right goal.
- Don't assume. If you need more context, ask me up to 3 questions first.

When you finish:
- Rate your work out of 10. Say what would make it a 10, then fix it.
- Push back on me: where is my thinking weak, what could go wrong, and what am I missing?
- Tell me the one next step to take.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS, so you're smarter next time.
=
Now let your AI set up your shortcuts for you. Open a new chat in your Business Hub, paste this, and do each step as it asks:

= Copy the shortcut setup prompt
Help me set up text shortcuts on my computer, so I type a short code in any app and the full text appears.

First ask me if I'm on a Mac or Windows. Then walk me through it one click at a time, and wait for me to say done before the next step.

Set up these shortcuts. Write the text for each one from my Business COMPASS, and show it to me before I save it:
- xx: my master prompt (I'll paste it in)
- bio: my bio in 3 sentences
- oneliner: what I do, who it's for and the result they get, in one sentence
- linkedinurl: my full LinkedIn link
- bookme: my booking or calendar link
- signoff: how I sign off my emails

When we're done, test one with me in this chat.
=
On a Mac, each shortcut ends up in System Settings, Keyboard, Text Replacements, like this:
! /portal/assets/master-prompt-shortcut.png | Text Replacements in System Settings, with xx set to the master prompt

The shortcuts it sets up:
| Type this | And you get |
| xx | Your master prompt |
| bio | Your bio in 3 sentences, for intros, speaker forms and podcasts |
| oneliner | What you do, who it's for and the result, in one sentence |
| linkedinurl | Your full LinkedIn link, so people can connect |
| bookme | Your booking or calendar link |
| signoff | How you sign off your emails |$tr$,
   null),
  (1, $tr$text$tr$, $tr$Open Business Surgery$tr$, 10,
   $tr$Today you set one goal and see where your hours really go. Every prompt below runs in a chat inside your Business Hub, from Step 4 of your setup. Speak your answers with Wispr Flow. If Wispr isn't working on the day, type them and fix it after the call.

First time running a prompt? Press Copy, open your Business Hub, start a new chat, paste and press Enter. If the AI asks you questions back, that's it working: answer them out loud with Wispr.

Any time you hand your AI a task of your own, give it these three lines:

= Copy the task brief
Result: (what done looks like, not the steps to get there)
Depth: (a fast first pass, or careful work where accuracy matters most)
Proof: (the check to run before handing it back)
=
Missed it live? Watch the recording on the Monday session above once it's posted.$tr$,
   null),
  (1, $tr$text$tr$, $tr$Write your North Star on paper$tr$, 20,
   $tr$Before you open any AI, write by hand:

1. Q4: 1 specific target by 31 December, with a number
2. Where should my time be invested?
3. What I'll stop doing
4. 1 hour daily commitment

Pre-revenue? Make your target your first paying customers, or the number of conversations with people who could pay you.

Then ask yourself: if this was the only result you got this quarter, would it set you up for 2027?$tr$,
   null),
  (1, $tr$link$tr$, $tr$Wispr your North Star into your Business Hub$tr$, 30,
   $tr$Open a new chat in your Business Hub and paste the prompt. Where it says to, turn on Wispr Flow and read your four answers from your paper: double-tap fn on Mac, or hold Ctrl + Win on Windows. Tap fn again to stop.

= Copy the prompt
Here is my North Star: (double-tap fn on Mac, or hold Ctrl + Win on Windows, and read out your four answers).

Before you assess it, ask me your clarifying questions, one at a time.

Then assess my goal with the 4 Cs:
1. Clarity: is my Q4 target one specific result, with a number and a date?
2. Context: from what you know about my business, is it realistic by 31 December, and what makes it harder?
3. Collaboration: who or what do I need to hit it, and where should I check in?
4. Cadence: does my 1 hour a day go to the work that moves this number?

Then rate your own assessment out of 10, tell me what would make it a 10, and give me my sharpened North Star in one line. Keep it, because every prompt after this works towards it.
=
What you'll get: a few questions first, so answer them out loud. Then a check of your goal against the 4 Cs, a score for its own work, and your North Star in one line. If your target has no number yet, add one now, even a rough one.$tr$,
   $tr$https://claude.ai/projects$tr$),
  (1, $tr$link$tr$, $tr$Build your Business COMPASS$tr$, 40,
   $tr$Your COMPASS is the one page your AI reads before every task: who you serve, what you sell and how you sound. Press Make my copy at the bottom of this card, then click under each heading, hold fn and talk. Messy is fine, and early is fine: if you haven't sold yet, say what you plan to sell and who you think it's for. You'll sharpen it every week.

+ What to say under each heading
One-liners
What you do, who it's for and the result they get, in one sentence.
Who I serve
Your best customers, or the ones you want, the problem keeping them up, and who you turn away.
What I sell
Your offers, what each costs, and the order people buy them in. No offer yet? Write the one you're testing.
My point of view
What most people in your industry get wrong.
Voice
How you sound, how you never sound, and how you sign off.
Current focus
Your North Star from today, where your 1 hour a day goes, and what you'll stop doing.
=
When it's done, add it to your Business Hub's Files (from Google Drive, or paste it in), then test it in a new chat:

= Copy the test prompt
Read my Business COMPASS. Tell me in three lines what you know about my business, and the biggest gap you can see.
=
If it can't find your COMPASS, check it's in the project's Files and that you started the chat inside the Business Hub, not on its own. If the three lines sound like you, it's working. Once a month, update its goal, offers and priorities.$tr$,
   $tr$https://docs.google.com/document/d/1c50ST_FSASEOCIh1z3GQhkdNl9eqFjY0asvk-MC1X5s/copy$tr$),
  (1, $tr$text$tr$, $tr$Build your ICP from your calls$tr$, 44,
   $tr$Your ICP is your ideal client profile: who buys from you, why, and the exact words they use. Once your AI knows them, everything it writes for you lands better. This runs on your recorded calls from Wispr Flow or any AI notetaker, connected in Step 3 of your setup. No recorded calls yet? Skip this for now and come back after your next few sales calls.

= Copy the prompt
Build my ICP from my Wispr Flow or AI notetaker notes. Read my Business COMPASS first. Give me who my ideal client is, the problem they feel, what makes them buy, their budget, their top objections and the exact phrases they use, quoting the calls. Write it as one page called "My ICP", then tell me the 3 points you're least sure about.
=
Save it as a Google Doc called My ICP in your Drive, and add it to your Business Hub's Files so every chat reads it.$tr$,
   null),
  (1, $tr$link$tr$, $tr$Run your Time Rich Audit$tr$, 50,
   $tr$This shows how much of your week actually makes you money, and the first 3 jobs to hand off. Open a new chat in your Business Hub, paste the prompt, then paste your 2-minute voice note of last week after "My last week:". No voice note? Paste your calendar.

= Copy the prompt
Run a Time Rich Audit on my last week. Read my Business COMPASS first. If it's missing or empty, ask me the 3 questions you need before you start.

1. List every task over 15 minutes with its hours.
2. Mark a task $ only if it put me in front of someone who can pay me this month AND it sells one of my offers. If I'm pre-revenue, a conversation with someone who could become a paying customer counts as $. Prep, admin and coffee with no ask are not $.
3. Give me my revenue number: the percentage of my hours that were $ tasks.
4. Give every non-$ task one owner: Skill (same steps every time), Agent (recurring, on a schedule or trigger), Human (a freelancer, assistant or teammate, now or later), or Me. Only mark Me if it's pricing, anything sent in my name, brand direction or hiring.
5. Name the 3 hand-offs that return the most hours this week. Write each as a 4 Cs brief: Clarity (what done looks like), Context (what's in my head), Collaboration (who's involved, where I check), Cadence (one-off or recurring, when it's due).

Don't invent tasks, hours or offers. If something is missing, ask me before you guess.

My last week:
=
What you'll get: a list of your tasks with hours, one percentage, and 3 short briefs you can hand to a person or an agent. A low percentage is normal in week 1. That number is what the next four weeks move. Check the hours against your memory: if the AI got one wrong, tell it and ask for the audit again.$tr$,
   $tr$https://claude.ai/projects$tr$),
  (1, $tr$text$tr$, $tr$Set up your first three Time Rich Agents$tr$, 90,
   $tr$These are your first Time Rich Agents. They draft. You send. Each one is a prompt that runs on a schedule, so it works while you don't. Pick your AI tool below for the setup, then copy an agent's prompt and set the time from the next drop-down. Run it once straight away to check it. Start with the one that would save you the most time this week. Not on Slack much? Skip the first one.

+ Set up an agent in Claude
1. Open the Claude desktop app and switch to Cowork at the top.
2. In the left sidebar, click Scheduled, then New task.
3. Give it a name, like Follow-up agent, paste the agent's prompt and choose when it runs.
4. Make sure Google Drive, Gmail and Slack are connected (Step 3 of your setup), so it can read your COMPASS and your inbox.
5. Click Run now to test it. Keep Claude open: scheduled tasks run while your computer is awake and the app is running.
+ Set up an agent in ChatGPT
1. Open a new chat in ChatGPT.
2. Start your message with when it runs, like "Every weekday at 9:00,", then paste the agent's prompt and send.
3. ChatGPT confirms the scheduled task. To pause or edit it, open your profile menu, then Tasks.
+ Set up an agent in Gemini
1. Open Gemini and start your message with when it runs, like "Every Monday at 8:00,", then paste the agent's prompt.
2. Confirm the scheduled action Gemini offers.
3. To pause or edit it, open Settings, then Scheduled actions. Scheduled actions need a Google AI Pro plan.

+ When each one runs, and where it saves
Slack in two passes
Every day at 9:00 and 15:00. Saves reply drafts in Slack.
Hot and warm contacts
Once now, then every Monday at 8:00. Saves a Hot + Warm Contacts sheet in your Drive.
Follow-up agent
Every second day at 8:00. Saves Gmail drafts, plus a summary email to you.
= Copy agent 1: Slack in two passes
Twice a day, scan my Slack since your last run. Read my Business COMPASS first so you know my priorities and my voice.
1. Find every message that needs me: DMs, @mentions, and threads where someone is waiting on my answer. Skip channels I only watch, bots, and messages I've already answered.
2. Sort them: Reply today, Can wait, FYI only.
3. For each Reply today and Can wait message, draft a reply in my voice. Short, clear, no filler. Save it as a draft in the right conversation. Never send anything.
4. Give me one list: who, what they need, your draft, and anything you need from me to finish it.
If nothing needs me, say so in one line.

Before you start: restate the goal of this run in one line.

When you finish:
- Rate your work out of 10, and say what would make it a 10.
- Don't stop to ask me questions while you run. List anything you weren't sure about, and the questions you'd have asked me.
- Tell me the one next step to take.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS, so you're smarter next time.
= Copy agent 2: Hot and warm contacts
Build my Hot + Warm Contacts list. Read my Business COMPASS and My ICP first, if I have one.
1. Pull contacts from my CRM if it's connected, my email and calendar from the last 90 days, and any CSV I upload (Luma guest lists, event sign-ups).
2. Score each one:
- Hot: replied, met me or showed buying intent in the last 30 days.
- Warm: engaged in the last 90 days but no clear next step.
Leave out everyone else, plus suppliers, team and personal contacts.
3. Save it as a Google Sheet called "Hot + Warm Contacts" in my Drive, with these columns: Name, Company, Email, Temperature (Hot or Warm), Last touch, Source, Why hot or warm, Next step. If you can't write to my Drive, give me the table to paste in.
4. Show me the first 10 rows before you save anything. On the weekly run, add new people and update Temperature and Last touch. Never delete a row.
Finish with the 5 contacts I should reach out to this week, and why.

Before you start: restate the goal of this run in one line.

When you finish:
- Rate your work out of 10, and say what would make it a 10.
- Don't stop to ask me questions while you run. List anything you weren't sure about, and the questions you'd have asked me.
- Tell me the one next step to take.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS, so you're smarter next time.
= Copy agent 3: Follow-up agent
Every second day, scan my email from the last 7 days. Read my Business COMPASS and my Hot + Warm Contacts sheet first.
1. Find every thread that needs a follow-up:
- someone asked me something and I haven't replied
- I sent something and they haven't replied in 3 days
- I promised something (a link, deck, intro, date) and haven't sent it
Skip newsletters, receipts, notifications and anything already handled.
2. Draft one follow-up per thread in my voice: short, warm, one clear ask. Save each as a Gmail draft in the same thread. Never send anything to anyone else.
3. Then send one email to me only, subject "Your follow-ups: (today's date)", listing each draft: who, why it needs a follow-up, and the first line of the draft. Hot contacts first.
If nothing needs a follow-up, send me a one-line email saying so.

Before you start: restate the goal of this run in one line.

When you finish:
- Rate your work out of 10, and say what would make it a 10.
- Don't stop to ask me questions while you run. List anything you weren't sure about, and the questions you'd have asked me.
- Tell me the one next step to take.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS, so you're smarter next time.
=
Each agent ends with the master prompt, written for a run with nobody there to answer: it lists its questions in the report instead of stopping to ask. Read the drafts before you send any of them. When one is off, tell the agent what to change in plain words, and it gets better each run.$tr$,
   null),
  (1, $tr$text$tr$, $tr$Build your next Time Rich Agent$tr$, 94,
   $tr$Got a hand-off from your Time Rich Audit that none of the three covers? Your AI interviews you, writes the agent's brief, then you test it on a real example and put it on a schedule the same way as your first three.

= Copy the interview prompt
Interview me to build my next agent. Read my Business COMPASS first and don't ask anything it already answers.
Ask one question at a time, with an example answer so I can reply fast. Cover:
1. The job: the one job this agent does for me, and what done looks like.
2. Inputs: where the information lives (inbox, calendar, Drive, Slack, files).
3. Standards: tone, length, what a great result looks like and what I'd reject.
4. The line: what it does alone, what it drafts for my approval, and what it never does.
5. Rhythm: when it runs and how it reports back.
Stop after 10 questions, or sooner if I say "build".
Then write the agent as one page called "Agent: (name)" with these sections: Job, Reads, Steps, Delivers, Never, Runs, Rules learned. Show it to me before I save it.

When you finish:
- Rate the brief out of 10. Say what would make it a 10, then fix it.
- Push back on me: where is my thinking weak, what could go wrong, and what am I missing?
- Tell me the one next step to take.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS, so you're smarter next time.
=
Save the page as a Google Doc in your Drive and add it to your Business Hub's Files. Then test it:

= Copy the test prompt
Run my new agent once on a real example from this week. Show me the result, then ask me the one change that would make it better. Add each change to Rules learned.

Before you start:
- Restate my goal in one line, and tell me if it's the right goal.
- Don't assume. If you need more context, ask me up to 3 questions first.

When you finish:
- Rate your work out of 10. Say what would make it a 10, then fix it.
- Push back on me: where is my thinking weak, what could go wrong, and what am I missing?
- Tell me the one next step to take.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS, so you're smarter next time.
=
+ Prefer to write the brief yourself?
Job: (one line: what this agent is for)
Reads: (where it looks: inbox, calendar, Drive, Slack, files)
Does: (the steps, in order)
Delivers: (what you get and where it lands)
Never: (what it must not do)
Runs: (when)$tr$,
   null),
  (1, $tr$text$tr$, $tr$Pick your personal AI agent$tr$, 60,
   $tr$An agent is an AI that does a job for you on its own, like sorting your inbox or booking meetings. Think of it as your first AI executive assistant. These overlap a lot, so pick one, not all of them: the one that lives where your work already is.

Give it one hand-off from your Time Rich Audit, and keep approval on so nothing goes out without your yes. Every agent in the table links to where you sign up.$tr$,
   null),
  (1, $tr$link$tr$, $tr$Preparation: Multi-LLM & Setting Your Harness$tr$, 70,
   $tr$Bonus session, Wednesday 28 October, live at 12pm ET on Zoom: using more than one AI model, and setting up your agents so they work safely.

Before the session:
1. Sign up to LaunchLemonade (3 months free) using the button below.
2. Log in and check that you can access your account.

That's all you need to do before the session. Once you're logged in, please don't do anything else on the platform yet. We'll work through the setup together during the masterclass.

If you already have an account, just check that you can log in.

Any issues? Email Wilfred Soriaga at wilfredsoriaga@launchlemonade.app or DM in Slack.

+ About Cien Solon and LaunchLemonade
Cien Solon is the co-founder and CEO of LaunchLemonade, a platform that helps businesses build and manage AI teammates securely. She has 11 years across technology, product and growth, has led engineering teams of up to 100, and mentors founders through Techstars and the British Library.
LaunchLemonade is where you build agents that do the work for you, using more than one AI model. It isn't a chat window for prompts. It's only for agents.$tr$,
   $tr$https://studio.launchlemonade.app/signup?voucher=TIMERICHLL$tr$),
  (1, $tr$text$tr$, $tr$10 Growth Prompts$tr$, 80,
   $tr$Run ONE before Friday 30 October. Small counts: the message you'd normally talk yourself out of sending is exactly the one.$tr$,
   null),
  (1, $tr$text$tr$, $tr$Give your AI your voice$tr$, 98,
   $tr$Your AI sounds generic until it has read you. Pick 3 to 5 pieces of your writing that sound most like you, like emails, posts or a proposal, and add them to your Business Hub's Files. Then teach it your voice once, and turn that into a skill so it's there every time.

= Copy the voice prompt
Read the writing samples in this project's files. Study how I write: the words I use, my sentence length and rhythm, how I open, how I sign off, and the words I never use.

Before you start:
- Restate my goal in one line, and tell me if it's the right goal.
- Don't assume. If you need more context, ask me up to 3 questions first.

Then rewrite the draft below so it sounds like me. Keep my meaning, cut the filler, and don't add facts I didn't give you.

When you finish:
- List the 5 voice rules you followed, so I can correct any that are wrong.
- Rate your work out of 10. Say what would make it a 10, then fix it.
- Push back on me: where is my thinking weak, what could go wrong, and what am I missing?
- Tell me the one next step to take.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS, so you're smarter next time.

My draft:

Blog URLs:
=
Paste a real draft after "My draft:", and links to anything you've published after "Blog URLs:". Correct any rule that's off and ask for the rewrite again until it sounds like you. Then, in the same chat:

= Copy: Turn this into a skill
Turn this into a skill called my-voice. Use the voice rules we just agreed and the writing samples in this project. Whenever I share a draft and say "in my voice", rewrite it this way and list the rules you followed.
=
+ What is a skill?
A skill is a how-to your AI saves and uses on its own whenever a task needs it. A prompt you paste every time; a skill you build once, and it comes into every chat where it fits.
Your voice makes a strong first skill, because almost everything you send should sound like you.
In Claude, switch skills on first: Settings, Capabilities, Skills. From then on, share any draft and write "in my voice".$tr$,
   null);

-- every row above: rewritten in place, so ids and ticks survive
update public.portal_items i
   set kind = w.kind, body = w.body, url = w.url, sort = w.sort, published = true
  from want w
 where i.week_id = w.week_id and i.title = w.title;

-- new rows (only if a renamed row was not there to move)
insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select w.week_id, w.kind, w.title, w.body, w.url, w.sort, true
  from want w
 where not exists (select 1 from public.portal_items i
                    where i.week_id = w.week_id and i.title = w.title);

-- off the page (kept, not deleted)
update public.portal_items set published = false
 where (week_id = 0 and title in ('Fill it in by voice', 'Make your copy of the Business COMPASS',
                                  'Say hello in #introductions'))
    or (week_id = 0 and title = 'Sign up to LaunchLemonade (3 months free)')
    or (week_id = 1 and title in ('This week: your photo and the TRC Club Code',
                                  'Audacious Action before Friday: finish your Business Hub'));

do $$
declare v integer; got text;
begin
  select string_agg(title, ' | ' order by sort) into got
    from public.portal_items where week_id = 1 and published;
  if got is distinct from
     'Your master prompt | Open Business Surgery | Write your North Star on paper | Wispr your North Star into your Business Hub | Build your Business COMPASS | Build your ICP from your calls | Run your Time Rich Audit | Pick your personal AI agent | Preparation: Multi-LLM & Setting Your Harness | 10 Growth Prompts | Set up your first three Time Rich Agents | Build your next Time Rich Agent | Give your AI your voice'
  then raise exception 'Week 1 is not in the order of the week: %', got; end if;

  select string_agg(sort || ' ' || title, ' | ' order by sort) into got
    from public.portal_items where week_id = 0 and published and sort >= 100;
  if got is distinct from
     '110 TRC Slack | 120 Add your photo and name | 130 Make sure you introduce yourself | 210 Get a paid AI plan and the desktop app | 220 Lock down your privacy | 230 Tell your AI how you work | 310 Install Wispr Flow | 320 Turn it on | 330 Connect your tools to your AI | 410 Create your Business Hub | 420 Paste in your Hub''s rules | 430 Check your Hub works | 510 Record last week in 2 minutes | 520 Answer the onboarding questions | 530 Join the Superhuman WhatsApp group'
  then raise exception 'Start here is not in five steps: %', got; end if;

  -- one LaunchLemonade link, on the voucher the 25 Oct migration set
  select count(*) into v from public.portal_items
   where published and url like '%launchlemonade.app%'
     and url <> 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL';
  if v <> 0 then raise exception '% published rows point at an old LaunchLemonade voucher', v; end if;

  select count(*) into v from public.portal_items where week_id = 0 and published and sort < 100;
  if v <> 2 then raise exception 'expected 2 pinned rows in Start here, found %', v; end if;

  -- everything a member pastes is in a copy box
  select count(*) into v from public.portal_items
   where published and (
         (week_id = 0 and title = 'Make sure you introduce yourself' and body like '%= Copy the template%LinkedIn. Full link%')
      or (week_id = 0 and title = 'Tell your AI how you work' and body like '%= Copy your preferences%')
      or (week_id = 0 and title = 'Paste in your Hub''s rules' and body like '%= Copy the instructions%')
      or (week_id = 0 and title = 'Check your Hub works' and body like '%= Copy the test prompt%')
      or (week_id = 1 and title = 'Wispr your North Star into your Business Hub' and body like '%= Copy the prompt%')
      or (week_id = 1 and title = 'Build your Business COMPASS' and body like '%= Copy the test prompt%'
          and url like 'https://docs.google.com/%/copy')
      or (week_id = 1 and title = 'Run your Time Rich Audit' and body like '%= Copy the prompt%')
      or (week_id = 1 and title = 'Build your ICP from your calls' and body like '%= Copy the prompt%')
      or (week_id = 1 and title = 'Give your AI your voice' and body like '%= Copy the voice prompt%= Copy: Turn this into a skill%')
      or (week_id = 1 and title = 'Set up your first three Time Rich Agents' and body like '%+ Set up an agent in Claude%+ Set up an agent in ChatGPT%+ Set up an agent in Gemini%= Copy agent 1%= Copy agent 2%= Copy agent 3%')
      or (week_id = 1 and title = 'Your master prompt' and body like '%= Copy the master prompt%= Copy the shortcut setup prompt%! /portal/assets/master-prompt-shortcut.png%| xx | Your master prompt |%')
      or (week_id = 1 and title = 'Build your next Time Rich Agent' and body like '%= Copy the interview prompt%= Copy the test prompt%'));
  if v <> 12 then raise exception 'expected 12 rows with their copy boxes or table, found %', v; end if;

  -- the master prompt's "When you finish" check rides on every agent prompt
  -- and on the voice prompt
  select count(*) into v from public.portal_items
   where week_id = 1 and published and (
         (title = 'Set up your first three Time Rich Agents'
          and (length(body) - length(replace(body, 'When you finish:', ''))) / length('When you finish:') = 3)
      or (title = 'Build your next Time Rich Agent'
          and (length(body) - length(replace(body, 'When you finish:', ''))) / length('When you finish:') = 2)
      or (title = 'Give your AI your voice' and body like '%When you finish:%'));
  if v <> 3 then raise exception 'expected the master prompt in the agent and voice prompts, found % rows', v; end if;

  select count(*) into v from public.portal_items
   where week_id in (0, 1) and published
     and (coalesce(body, '') || title) ~* '(→|—|–|\[|\]|TBC|wins-gifts|before monday|\mthings?\M)';
  if v <> 0 then raise exception '% published rows have an arrow, a long dash, brackets, TBC, #wins-gifts, Before Monday or "thing"', v; end if;
end
$$;

commit;

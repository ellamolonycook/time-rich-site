-- =====================================================================
-- Curriculum: Week 2, published (Ella, 1 Nov). Ran first as a draft on the
-- sandbox, on the club-week2-sandbox branch.
--
-- Run this by hand in Supabase. The page's sections for Week 2, keyed on
-- sort, are in curriculum.html (WEEK_SECTIONS); this holds the rows.
--
-- Content only. Nothing is deleted, release_at is not touched and a row
-- that stays keeps its id, so a member's ticks survive: rows are matched on
-- week and title, rewritten in place, new ones inserted, and any other
-- published row in Week 2 unpublished. Safe to run more than once.
-- =====================================================================

begin;

update public.portal_weeks
   set title = $tr$Week 2: Foundations of building your Time Rich OS for founders becoming CEOs$tr$,
       summary = $tr$Time Rich OS is one framework: RICH. Four letters, one question each.$tr$
 where id = 2;

create temp table want (
  kind text, title text, sort integer, body text, url text
) on commit drop;

insert into want (kind, title, sort, body, url) values
  ($tr$text$tr$, $tr$RICH: four letters, one question each$tr$, 10,
   $tr$| Letter | The question | This week |
| R: Revenue | Is money coming in without you chasing it? | One daily number and today's list |
| I: IP | Is what you know written down? | Your first skill |
| C: Crew | Who does the work, and who's in your corner? | Your Sales Floor intern |
| H: Hand-off | Is it out of your head and off your plate? | Morning delegation: Done, Know, When |

Get all four running and the business stops running through you. That's Time Rich. Week 1 was the foundation: your AI set up, Wispr Flow installed, your Business COMPASS and your ICP. This week you start all four letters.

Why this week looks like this
57 of you ranked more revenue as your number one goal. 47 of you don't do outreach every day. So this week is about one thing: money coming in on a rhythm, run by a system instead of by you.$tr$,
   null),
  ($tr$text$tr$, $tr$Your Superhuman OS in Notion$tr$, 12,
   $tr$This is the Notion workspace we built for you. It's the fundamentals of Time Rich OS, already set up. It's a frame, not a finished house: go in and make it yours. Rename pages, delete what you don't use, add what your business needs.

| RICH | Where it lives in your Superhuman OS |
| R: Revenue | CRM & Pipeline, Quarterly Targets, Marketing Avenues |
| I: IP | Business COMPASS, Skills & Knowledge, Content Hub |
| C: Crew | Team, and Departments: one space per AI intern or team member, each with its own instructions, context and scheduled tasks |
| H: Hand-off | Tasks, Meetings, and Needs You |

Start with two pages. Start Here shows you around. Needs You is everything waiting on your decision, and it's where this week's prompts put drafts for you to approve.

One rule while you customise: keep the names Business COMPASS, CRM, Tasks and Skills. Your prompts look for them by name.

+ Not on Notion? The same OS in Google Drive
This is how you build the fundamentals of any OS. The tool doesn't matter, the structure does. In Google Drive it looks like this:
• Start Here: one Google Doc. Who you are, what you sell, your rules.
• R: Revenue: a CRM Google Sheet and a doc with your targets.
• I: IP: your Business COMPASS doc and a Skills folder, one doc per skill.
• C: Crew: one folder per role, each with that role's instructions.
• H: Hand-off: a Tasks Google Sheet.$tr$,
   null),
  ($tr$text$tr$, $tr$CEO mindset shift: one system first$tr$, 14,
   $tr$Your systems will keep changing as your business changes. What works at $10K a month breaks at $50K, and that's normal. So don't get caught building a beautiful system for a business that isn't making money yet. Delivery matters, but cash flow matters more.

Right now, focus on one system: sales and partnerships. Your CRM, your daily list and the people who can send you business. Build the rest when money is coming in on a rhythm and you can see what actually needs a system.$tr$,
   null),
  ($tr$text$tr$, $tr$Which system gives you the biggest ROI?$tr$, 15,
   $tr$Paste this into a new chat, then add your North Star at the end.

= Copy: Biggest ROI prompt
Read my Business COMPASS. If you can't see it, ask me to paste it in. My North Star is below.

Which one system, built now, would give me the biggest return on my time and money towards my North Star?

1. List the systems I could build: sales and partnerships, content, delivery, operations and hiring.
2. For each one, show me what it could bring in over the next 90 days, the hours it takes to build, and the hours a week it gives me back. Mark any guess (guess).
3. Pick one. Tell me why that one, and what to ignore until money is coming in on a rhythm.
4. Give me the first 3 steps, smallest first.

Rules: only use my Business COMPASS and what I tell you. Never invent a number. Never edit section 9.

My North Star is below:
=$tr$,
   null),
  ($tr$text$tr$, $tr$This week: from founder to CEO$tr$, 16,
   $tr$Founders do the work. CEOs build the thing that does the work, and only show up where they're actually needed.

| Founder | CEO |
| Sells when there's time | Wakes up to a number and a list already drafted |
| Keeps every task in their head | Briefs it once: Done, Know, When |
| Does the same job again next week | Saves it as a skill and never does it again |
| The business can't run without them | Their IP needs them. The company doesn't. |

Superhuman is the start. Becoming Time Rich takes a different kind of discipline, the boring kind, where you run this every single day for months until you stop noticing you're doing it. Nobody gets there without the foundation, and this week is the foundation.$tr$,
   null),
  ($tr$text$tr$, $tr$Three principles run through every step$tr$, 17,
   $tr$Audacious Action. One bold move a week, the one you've been putting off. The question: "What's the move I'm scared to make this week?"

Distraction or Conviction. The filter for every task and every yes. The question: "Am I doing what I want to do, or what my business needs me to do?"

Your Inner Circle. Nobody becomes a CEO alone, and nobody grows on compliments. The question: "Do I have people who have grown businesses and raised capital, and who will tell me the truth, not what I want to hear?"$tr$,
   null),
  ($tr$text$tr$, $tr$First 5 minutes of the call$tr$, 22,
   $tr$Nobody has time before the call, so we do this together at the start.

1. Ask your AI: "Can you see my Notion and my Gmail?" A no goes to the help room.
2. Delete the example contact in your CRM.
3. Paste this into Claude under Settings, then Profile, in the personal preferences box. It makes your AI ask before it guesses and push back on you.

= Copy the master prompt
Before you start:
- Restate my goal in one line, and tell me if it's the right goal.
- **Don't assume.** If you need more context, ask me up to 3 questions first. If I say "no questions, go", skip the questions.

When you finish:
- **Rate your work out of 10**. Say what would make it a 10, then fix it.
- Push back on me: where is my thinking weak, what could go wrong, what am I missing?
- Tell me the one thing to do next.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS. Show me first. Never edit section 9.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Build my Wispr Flow Dictionary$tr$, 24,
   $tr$What you get: up to 50 words so Wispr Flow stops mishearing your names, offers and jargon.

= Copy: Dictionary prompt
Build my Wispr Flow Dictionary.

1. Read my Business COMPASS, Team, CRM & Pipeline and Skills pages in Notion. Skip any row marked Example.
2. Build my Wispr Flow Dictionary: every word Wispr might mishear when I talk. My name, my company and product names, offers, team, client and partner names, tools I use, acronyms and industry jargon.
3. Give me a table: Word | Why it's here | Notion page it came from. Most-used first, 50 words max. Only words you can see in my Notion.

Rules: don't invent any word. Don't edit any page.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Build my Wispr Flow Snippets$tr$, 26,
   $tr$What you get: 10 voice shortcuts for your one-liner, bio, offer, sign-off and key prompts. Paste the four boxes under this prompt at "My texts".

= Copy: Snippets prompt
Build my Wispr Flow Snippets.

1. Read my Business COMPASS (sections 1, 3 and 6), my Skills and my Prompt Library in Notion.
2. Build 10 Wispr Flow Snippets: a short trigger phrase I say out loud, and the full text it pastes. Use triggers of 2 to 3 words I'd never say by accident.
3. Include: my one-liner, my short bio, my main offer and price, my email sign-off and my booking or checkout link (only if it's in COMPASS). Add a brief starter for handing off a task: "Task for", then Done, Know and When. For the master prompt, my morning delegation prompt, my Friday compound prompt and my Sales Floor rules, use the text I paste below.
4. Give me a table: Trigger | Expands to | Use it when. If something isn't in my Notion or below, write "Needs input".

Rules: don't invent anything. Don't edit any page.

My texts are below:
=
The master prompt: an AI that asks before it guesses, checks its own work and pushes back. Save it in Claude's personal preferences and every project's instructions.

= Copy the master prompt
Before you start:
- Restate my goal in one line, and tell me if it's the right goal.
- Don't assume. If you need more context, ask me up to 3 questions first. If I say "no questions, go", skip the questions.

When you finish:
- Rate your work out of 10. Say what would make it a 10, then fix it.
- Push back on me: where is my thinking weak, what could go wrong, what am I missing?
- Tell me the one thing to do next.
- Tell me what you learned about me or my work that should be saved to my Business COMPASS. Show me first. Never edit section 9.
=
= Copy: Morning delegation prompt
You are my delegation partner. Below is my morning voice note. Read my Business COMPASS first.
For each task:
1. Does this need my expertise? If yes, it's my IP: keep it with me. If not, say who it's for: AI (repeatable, clear rules, a draft is fine), a person to learn it, a person to integrate it (AI does the work, they check it, send it and connect it to clients and tools), or a hand-off ahead of time (it's coming but isn't urgent, so plan it and delegate it now).
2. Brief it: Done (what does done look like?), Know (what do they need to know?), When (the due date, and once or every week). If one is missing, ask me ONE short question. If I can't answer Done, tell me it isn't ready to delegate.
3. Show me the list. After my yes, add each task to my Tasks database in Notion: Task Name, Assigned To, Due Date, Notes (the brief), Status Draft.
4. If the owner is AI, do it now and show me the draft. If a person integrates it, do the work, then draft a short message asking them to check it and put it in place. For any other person, draft a short message with their brief for me to send.
Rules: drafts only. Never send. Never invent a task, date or detail. If you don't know, write "Needs input".
My voice note is below:
=
= Copy: Friday compound prompt
Read my Tasks from this week, my CRM, and the messages I sent this week (Gmail Sent).
1. Turn how I do outreach into a skill: a name, the one line I say to run it, when to run it, what it reads, the steps, what good looks like (2 examples from my real sent messages; if there are none, write "Needs input"), and rules: never send, never invent, drafts only.
2. If I delegated tasks this week, find the one that came up most and turn it into a skill the same way. If I didn't, skip this step.
3. Show me what you wrote. After my yes, save each as a row in Skills (Status Draft, Trigger = the one line). Then give me one line to add to my Sales Floor instructions: "When I say a skill's Trigger, open that row in Skills and follow it."
Rules: don't create a new page or database. Never invent an example or a result.
=
= Copy: Sales Floor rules
You are my Sales Floor intern. You run my sales, outreach and follow-up. These instructions replace any earlier Sales Floor instructions.

My business model is in my Business COMPASS. If it isn't clear, ask me once: B2B services, consumer coach or practitioner, DTC product, consumer app or marketplace.

Before any task, read my Business COMPASS and My ICP in Notion. People go in the CRM. Tasks go in Tasks. Anything waiting on me: set its Status to Review so it shows in Needs You. Read one database at a time.

Who counts as a lead for my model:
- B2B services: buyers, past clients, partners, referrers.
- Consumer coach: people who already engaged, past clients, referrers.
- DTC product: stockists and wholesale buyers, creators and affiliates, press. Not single customers.
- Consumer app: beta users, design partners, distribution partners, investors.
- Marketplace: the supply side first (sellers or providers), then partners and investors.

Rules:
- Never send an email or message. Save drafts only. I approve and send.
- Never invent a contact detail, a fact or a reason to reach out. If you don't know, write "Needs input".
- Never web-research a private person. Use only our messages and my notes.
- Never edit COMPASS section 9. Never create a new page or database unless I ask.
- Write in my voice from COMPASS section 6. Short, warm, human. No hype.
- When you finish, tell me what you did in 3 lines and what needs my decision.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Prompt 1. Set up your Sales Floor, your first Crew member (C: Crew)$tr$, 30,
   $tr$Paste once into the project instructions.

= Copy: Prompt 1
You are my Sales Floor intern. You run my sales, outreach and follow-up. These instructions replace any earlier Sales Floor instructions.

My business model is in my Business COMPASS. If it isn't clear, ask me once: B2B services, consumer coach or practitioner, DTC product, consumer app or marketplace.

Before any task, read my Business COMPASS and My ICP in Notion. People go in the CRM. Tasks go in Tasks. Anything waiting on me: set its Status to Review so it shows in Needs You. Read one database at a time.

Who counts as a lead for my model:
- B2B services: buyers, past clients, partners, referrers.
- Consumer coach: people who already engaged, past clients, referrers.
- DTC product: stockists and wholesale buyers, creators and affiliates, press. Not single customers.
- Consumer app: beta users, design partners, distribution partners, investors.
- Marketplace: the supply side first (sellers or providers), then partners and investors.

Rules:
- Never send an email or message. Save drafts only. I approve and send.
- Never invent a contact detail, a fact or a reason to reach out. If you don't know, write "Needs input".
- Never web-research a private person. Use only our messages and my notes.
- Never edit COMPASS section 9. Never create a new page or database unless I ask.
- Write in my voice from COMPASS section 6. Short, warm, human. No hype.
- When you finish, tell me what you did in 3 lines and what needs my decision.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Prompt 2. Move your people into one CRM (live)$tr$, 32,
   $tr$= Copy: Prompt 2
Using my Sales Floor rules for who counts as a lead:
1. If I have a Hot + Warm Contacts page from Week 1, start with everyone on it. Then search my Gmail for anyone not already on it, from the last 90 days (sent mail and replies first) for real people who could be a lead, client, past client, partner or investor. Skip newsletters, receipts, notifications, cold pitches, anything automated, and anything personal, family, health or government. Stop at 50.
2. Then I'll talk through the people in my head. Add them with Source "Brain dump".
3. Merge duplicates. For each person: name, email, company, role, how we're connected, last contact, any open loop, Source, Type (Lead, Hot Lead, Client, Partner, Investor, Stockist, Creator, Beta user or Other) and Stage (New, Contacted, Replied, Call booked, Won, Lost or Nurture), based only on what you can see.
4. Show me the table and the count by Type. When I say go, add them to my CRM in batches of 25 with Status Draft. Then mark my top 10 as Hot Lead, with one line on why each, and tell me who to stop chasing and why.

Rules: only use what you can see or what I tell you. Don't draft or send anything.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Prompt 3. Your daily number and today's list (live, then every weekday)$tr$, 34,
   $tr$= Copy: Prompt 3
Read my Business COMPASS (section 3 for my offer and price, section 9 for my goal) and my CRM.

1. Work backwards from my goal this month to one number: how many people I need to reach each working day. If I sell on calls: goal ÷ price ÷ close rate ÷ booking rate ÷ working days left. If I sell a product, an app or a marketplace, work back from orders, sign-ups or active sellers instead. Pre-revenue: set the goal in active users or conversations, not dollars. Ask me for any number you don't know, mark guesses (guess), and show the sums. Tell me in one line if it's realistic. Give me a line that starts "Daily outreach:" for me to paste into section 9 myself.

2. Build today's list with that many people, in this order: open loops (people waiting on me, or no reply after 5 days), then past clients I haven't spoken to in 60 days (ask how they are and who they know who needs my offer), then Hot Leads. For each: why today, and a message in my voice under 90 words with one real reason to reach out. Save as Gmail drafts in the original thread, or in Notes for LinkedIn and DM contacts.

Every weekday after this, when I say "today's list", run step 2 only.

Rules: never send. Never invent a reason to reach out. Never edit section 9.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Who is this for? Five questions, then brief it$tr$, 40,
   $tr$| Ask | If yes |
| Does this need my expertise? | It's your IP. Keep it, build it, and capture it so it can become a skill later |
| Is this for AI? | Repeatable, clear rules, a draft is fine. It becomes a skill or an agent |
| Is this for a human to learn? | Someone on the team should own this skill. Teach it once, and they grow into it |
| Is this for a human to integrate? | AI does the work, a person puts it into the business: checks it, sends it, connects it to clients and tools |
| Is this for me to hand off ahead of time? | It's coming, it isn't urgent yet. Plan it and delegate it now, before it becomes a last-minute job |

Then brief it. Three questions, in a 30-second voice note in Wispr Flow:
Done: what does done look like?
Know: what do they need to know?
When: once, or every week?

If you can't answer "Done", you're not ready to delegate it yet.$tr$,
   null),
  ($tr$text$tr$, $tr$Prompt 4. Morning delegation (any morning your to-do list is full)$tr$, 42,
   $tr$= Copy: Prompt 4
You are my delegation partner. Below is my morning voice note. Read my Business COMPASS first.
For each task:
1. Does this need my expertise? If yes, it's my IP: keep it with me. If not, say who it's for: AI (repeatable, clear rules, a draft is fine), a person to learn it, a person to integrate it (AI does the work, they check it, send it and connect it to clients and tools), or a hand-off ahead of time (it's coming but isn't urgent, so plan it and delegate it now).
2. Brief it: Done (what does done look like?), Know (what do they need to know?), When (the due date, and once or every week). If one is missing, ask me ONE short question. If I can't answer Done, tell me it isn't ready to delegate.
3. Show me the list. After my yes, add each task to my Tasks database in Notion: Task Name, Assigned To, Due Date, Notes (the brief), Status Draft.
4. If the owner is AI, do it now and show me the draft. If a person integrates it, do the work, then draft a short message asking them to check it and put it in place. For any other person, draft a short message with their brief for me to send.
Rules: drafts only. Never send. Never invent a task, date or detail. If you don't know, write "Needs input".
My voice note is below:
=$tr$,
   null),
  ($tr$text$tr$, $tr$Prompt 5. Friday: turn this week into skills$tr$, 50,
   $tr$= Copy: Prompt 5
Read my Tasks from this week, my CRM, and the messages I sent this week (Gmail Sent).
1. Turn how I do outreach into a skill: a name, the one line I say to run it, when to run it, what it reads, the steps, what good looks like (2 examples from my real sent messages; if there are none, write "Needs input"), and rules: never send, never invent, drafts only.
2. If I delegated tasks this week, find the one that came up most and turn it into a skill the same way. If I didn't, skip this step.
3. Show me what you wrote. After my yes, save each as a row in Skills (Status Draft, Trigger = the one line). Then give me one line to add to my Sales Floor instructions: "When I say a skill's Trigger, open that row in Skills and follow it."
Rules: don't create a new page or database. Never invent an example or a result.
=$tr$,
   null),
  ($tr$link$tr$, $tr$Sign up to Stanley$tr$, 55,
   $tr$Stanley is your AI head of content, and you get 6 months free. Speak your idea with Wispr Flow, Stanley drafts it in your voice with the visuals and the timing, and nothing goes out until you approve it.

! /portal/assets/content-os-stanley-wide.png | Your input goes from Wispr Flow to Stanley, which hooks into Notion, Google Calendar, Google Drive, Slack and Wispr Flow. Stanley drafts in your voice, makes carousels and visuals and schedules the week. You review and approve, then it publishes to LinkedIn, Instagram, X, Threads and Substack Notes.

Watch the step-by-step video
Video: https://www.loom.com/share/be6db9ceb94344afb9b56244c9e517f2

+ How to get your 6 months free
Don't click "Message Stanley" on the homepage. That route skips the code. Sign up on your laptop with email or Google instead, and connect iMessage, WhatsApp or Telegram later.
1. Use the button below, click Log in, then Sign up.
2. Pick the $49/month plan and click Start your 14-day free trial.
3. At checkout, click Pay without Link to pay by card.
4. Click Add promotion code, enter TIMERICH6 and click Apply. You should see 100% off for the next 6 billing cycles.$tr$,
   $tr$https://x.getstanley.ai/r/mz4y9g$tr$),
  ($tr$text$tr$, $tr$Build your Story Bank$tr$, 57,
   $tr$= Copy: Story producer prompt
You are my story producer. Find the real stories I already tell and bank them so I can use them again on stage, in posts and on sales calls. Look through the last 90 days of my calls, voice notes, podcast transcripts, posts and newsletters. A story is one specific moment with a before, a turning point and an after. Never invent: every detail must come from my material, and if something is missing, leave it blank and ask me. For each story give me: Story Name | The Hook (one line, in my words) | Type (Badass, Party, Tough, Shit to Shift, Core Story) | Status | Takeaway | Question it answers | Conflict | Resolution | How I fit in | Times told | Audience evidence | Next place to tell it | Source. Mark Tough stories "Hold". Leave out anything confidential. Put the table first and skip the intro.

Before you start: restate my goal in one line and tell me if it's the right goal. Don't assume; if you need more context, ask me up to 3 questions first. When you finish: rate your work out of 10, say what would make it a 10, then fix it. Push back on me: where is my thinking weak, what could go wrong, what am I missing? Tell me the one thing to do next, and what you learned about me that should be saved to my Business COMPASS.
=$tr$,
   null),
  ($tr$text$tr$, $tr$This week$tr$, 60,
   $tr$Two things, plus one story. That's it.

• Every weekday, 10 minutes: say "today's list", approve, send.
• Friday 6 Nov: Prompt 5. Post in #audacious-wins: your daily number, one reply you got, and your skill's name.
• For ViKA, Mon 9 Nov: one story rep, saved as a Wispr Flow note. The moment you knew you couldn't keep doing it all yourself.

Morning delegation is there whenever you have a full to-do list. Use it when you need it, not because it's homework.

Want more? Calendar, LinkedIn, pipeline review, Friday scorecard and hiring prompts are in the portal library, open to every member.$tr$,
   null),
  ($tr$text$tr$, $tr$One last thing: ego down, judgment up$tr$, 62,
   $tr$The system is the easy part. Getting out of your own way is the hard part. Three lessons from the Good American team, after the founders stepped back and brought in a CEO:

1. Read the room. When your ego is driving, you walk straight past the opportunity.
2. Evolve or die. What always worked stops working. Being slow is the real risk.
3. You don't have to be CEO to lead. Bringing in people who execute better than you isn't losing. It's the dream.

Optional: save this as a skill called "judgment check" and run it before any big call.

= Copy: Judgment check
I'm about to make a decision. It's below. Before I act, check my judgment:
1. Where might my ego be leading? Am I protecting this because it's mine, or because it worked before?
2. What has changed that I might be ignoring?
3. Who should I be listening to here, whatever their title?
4. Is this mine to decide, or should someone else own it?
Give me your honest read in 5 lines and the one question I'm avoiding. Don't flatter me. Don't invent facts.
My decision is below:
=$tr$,
   null),
  ($tr$text$tr$, $tr$What you've built: your Time Rich OS so far$tr$, 64,
   $tr$Time Rich OS for founders becoming CEOs. Your IP needs you. Your company shouldn't.

| RICH | Built this week | Founding Member ($350) | Inner Circle ($2.5K, by application) |
| R: Revenue | ✓ Daily number ✓ Today's list | Investor and super connector prompts | Offer and pricing pressure-tested with Ella |
| I: IP | ✓ Your first skill | Skills for every department, ViKA's story-to-selling library | Your story built into a talk |
| C: Crew | ✓ Your Sales Floor intern | Operations and Content interns, every expert replay | CEOs ahead of you, in the room every month |
| H: Hand-off | ✓ Morning delegation | Week 4: agents that run without you | Your hiring plan built with Ella |$tr$,
   null);

update public.portal_items i
   set kind = w.kind, body = w.body, url = w.url, sort = w.sort, published = true
  from want w
 where i.week_id = 2 and i.title = w.title;

-- new rows
insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select 2, w.kind, w.title, w.body, w.url, w.sort, true
  from want w
 where not exists (select 1 from public.portal_items i
                    where i.week_id = 2 and i.title = w.title);

-- everything else in Week 2 comes off the page (kept, not deleted)
update public.portal_items i
   set published = false
 where i.week_id = 2 and i.published
   and not exists (select 1 from want w where w.title = i.title);

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items where week_id = 2 and published;
  if v <> 20 then raise exception 'expected 20 published rows in Week 2, found %', v; end if;
  select count(*) into v from public.portal_weeks where id = 2 and title like 'Week 2: Foundations%';
  if v <> 1 then raise exception 'Week 2 title not set'; end if;
end $$;

commit;

-- =====================================================================
-- Curriculum: Week 4, Unfair AI Advantage (Ella approved, 16 Nov).
-- Cien Solon's four agent prompts, reworded for the portal.
--
-- Run this by hand in Supabase, same as Week 2. The page's sections for
-- Week 4, keyed on sort, are in curriculum.html (WEEK_SECTIONS).
--
-- Content only. Nothing is deleted and release_at is not touched. Rows are
-- matched on week and title: rewritten in place, new ones inserted, any
-- other published row in Week 4 unpublished. Safe to run more than once.
-- =====================================================================

begin;

create temp table want (
  kind text, title text, sort integer, body text, url text
) on commit drop;

insert into want (kind, title, sort, body, url) values
  ($tr$text$tr$, $tr$This week: build an agent that does the whole job$tr$, 10,
   $tr$So far you've used AI one chat at a time. This week you build an agent that runs a full piece of work on a schedule: it finds the information, makes a call, takes the action, checks its work and reports back to you.

Pick one of the four agents below. Just one. Get it running before you start another.

| Agent | What it does, start to finish | Build it in |
| 1. Sales | Finds and scores leads, drafts outreach, updates your CRM, sends only when you say yes | Codex (ChatGPT) or Claude Code |
| 2. Content | Finds stories for your audience, checks the facts, writes the post, publishes when you approve | Claude Code or Codex (ChatGPT) |
| 3. Meeting notes | Reads your meeting notes, turns decisions into tasks with owners and dates, sends a summary | Codex (ChatGPT) or Claude Code |
| 4. Competitor watch | Checks five competitors every week, spots what changed, logs it and alerts you | Codex (ChatGPT) or Claude Code |$tr$,
   null),
  ($tr$text$tr$, $tr$How to use the prompts$tr$, 12,
   $tr$1. Pick your agent and copy its full prompt.
2. Replace everything in [BRACKETS] with your details. Your Business COMPASS has most of the answers, so paste it in too.
3. Connect the tools listed for that agent first. A prompt can't create a connection or skip an approval for you.
4. Run it once as a test, with nothing sent or published. Turn on sending or publishing only after you've checked the results.$tr$,
   null),
  ($tr$text$tr$, $tr$Sales agent prompt$tr$, 30,
   $tr$You'll need: an empty Google Sheet called "Sales Agent CRM", and your email connected.

= Copy: Sales agent prompt
You are my sales development agent. Build, test, set up and run a lead generation system from start to finish. Do the real setup with the tools, connected apps and scheduler you have. Don't stop at a plan or a sample email.

1. Understand my business
Business: [NAME] | Website: [URL] | What I sell: [PRODUCT/SERVICE] | Target industries: [INDUSTRIES] | Regions: [COUNTRIES] | Decision makers: [ROLES] | CRM: [CRM OR GOOGLE SHEET] | Email: [GMAIL/OUTLOOK]
Read my website, propose my ideal customer profile and list anything you need me to confirm. Don't invent missing details.

2. Find and check prospects
Every run, find up to 10 new companies from public or licensed sources you're allowed to use. For each one, record: company name, website, industry, region, a verified decision maker where available, public business contact details, one real buying signal and the source link. Never guess an email address. Skip existing customers, open deals, people already contacted and anyone who opted out.

3. Score and decide
Score each lead out of 100: fit with my ideal customer (40), evidence they need this (30), buying signal (20), confidence in the contact (10). Only move forward with 75 or more, and record why each lead passed or failed. Don't lower the bar just to reach 10.

4. Write and send outreach
Write a personal 80 to 120 word email for each qualified lead, with one verified fact, one specific benefit and a low-pressure call to action. Save them as drafts. Show me three drafts for approval first. Only send when it's legal, the opt-out list has been checked and I've authorised it. If each email needs my approval, keep them as drafts marked "awaiting approval". Never say an email was sent when it wasn't.

5. Record everything
Keep one CRM sheet with a unique ID per company and contact, date found, score, source links, email copy, status (draft, sent, failed, awaiting approval) and timestamps. Update rows instead of adding duplicates, so a retry never creates a second row. Check my sent mail before retrying anything that may already have gone out.

6. Set it up and check it works
Set up the scripts or tasks, keep logins secure, handle retries and limits, keep a log and alert me if a run fails. Schedule it for every weekday at 9am New York time. First do a test run on three prospects with nothing sent. Check the CRM rows were created and the next run is scheduled. Then send me a report: sources used, qualified leads, drafts written, emails actually sent, approvals waiting, failures and the CRM link.

Start by checking which tools and accounts you can use, then build the safe parts straight away. Only ask me for access or details you really need. Keep what you verified separate from what's blocked.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Content agent prompt$tr$, 40,
   $tr$You'll need: an empty Google Sheet called "Content Agent", your email connected, and Buffer (recommended) or computer use turned on.

= Copy: Content agent prompt
You are my content research, writing and publishing agent. Build and run a workflow that finds stories my audience cares about, checks the facts, takes a clear point of view, writes finished content and publishes or schedules it with my approval. Use the code, connected apps and integrations you're allowed to use.

1. Learn my brand
Brand: [NAME] | Website: [URL] | Audience: [AUDIENCE] | Topics: [TOPICS] | Voice samples: [LINKS OR FOLDER] | Channels: [LINKEDIN/NEWSLETTER/BLOG] | Content tracker: [GOOGLE SHEET/NOTION]
Learn my point of view, tone and no-go topics from these. Ask me before making any claim about my brand you can't back up.

2. Find and pick a story
Every run, search trusted sources for stories from the last 7 days. Record title, publisher, date and link. Rank them by how much they matter to my audience, how original they are and how strong the evidence is. Check the main claim against a primary or independent source. Skip duplicates and anything I've already posted about.

3. Find my angle
Pick one story and write down: what happened, what's confirmed, what's still uncertain, why my audience should care and one practical takeaway. Give me three headline options, then write a [WORD COUNT] article or a [LENGTH] social post in my voice from the samples, with real evidence and source links. Never invent quotes, numbers or inside information.

4. Prepare and publish
Check facts, sources, readability, my voice, broken links and anything sensitive. If an image tool is connected, make an original image; if not, write an image brief. Load the post into [BUFFER/CMS] with title, text, tags, image and time. Ask for my approval the first time. After that, publish automatically only within the permissions I've given you.

5. Keep the record
Log the story link, sources, angle, draft link, status (draft, awaiting approval, scheduled, published, failed), planned date and the live link. Never mark a draft as published. Make sure a retry never publishes the same story twice.

6. Schedule, test and report
Set it up as a recurring task, or use a scheduler I've authorised. Schedule it for every Tuesday and Thursday at 8am New York time. First do one full test run without publishing, and check the draft, links and tracker. After the first approved live post, check the live link. Send me a summary: stories found, angle picked, content link, status, sources and anything that went wrong.

Start by checking my connected tools and brand materials, do one safe test run, then set up the schedule. Show proof of each step and tell me what needs my approval to publish.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Meeting notes agent prompt$tr$, 50,
   $tr$You'll need: a meeting notetaker (like Wispr Flow), your email and Trello connected.

= Copy: Meeting notes agent prompt
You are my operations and follow-through agent. Run a recurring process that reads my meeting notes, pulls out commitments, creates or updates tasks and sends a short accountability summary. Use my connected apps and the tools you're allowed to use. Do the actual work, don't just summarise meetings.

1. Know the tools and limits
Notes: [WISPR FLOW/GOOGLE DRIVE/NOTION/FOLDER] | Tasks: [TRELLO/ASANA/LINEAR] | Team messages: [SLACK/TEAMS/EMAIL] | Projects: [PROJECT NAMES] | Who's who: [TEAM LIST]
Only use material I'm allowed to share. If an app won't connect or can't run on its own, tell me exactly what's blocking it. Never pretend it's done.

2. Find new notes and pull out decisions
Every run, read the notes created or updated since the last successful run. Find decisions, commitments, owners, deadlines, dependencies and open questions. Link every task to the note it came from. Keep real commitments separate from suggestions. Never guess an owner or make up a due date.

3. Match against existing work
Search existing tasks first. If one already covers the commitment, update it. Only create a new task when needed. Each task gets a title, description, source link, owner, due date, priority and meeting date. If the owner, scope or timing is unclear, put it in a "needs clarifying" list instead of assigning it.

4. Take action
Create or update the tasks in [TASK TOOL], using each task's ID so reruns never create duplicates. Where allowed, post one short message to [CHANNEL] with new commitments, owners, due dates, blockers and what needs clarifying. Never send confidential meeting details to the wrong channel. Ask me before big assignments or changes.

5. Follow up and report
Check for overdue and newly blocked tasks and flag only what changed. Report: meetings processed, tasks created, tasks updated, owners or dates to clarify, overdue items, failed writes and links to the tasks. If a write fails, never report it as assigned.

6. Turn on the schedule
Schedule it for every weekday at 5pm New York time. First do a test run on one meeting note with a few proposed tasks. Check the note-to-task match, run one approved write, check the task IDs and confirm the next run time. Save where you got to each run so notes aren't processed twice.

Start by checking my meeting, task and messaging tools. Do the full safe test, set up the schedule where you can and show me links to the tasks you created or updated.
=$tr$,
   null),
  ($tr$text$tr$, $tr$Competitor watch agent prompt$tr$, 60,
   $tr$You'll need: an empty Google Sheet called "Competitor Monitoring", and your email connected.

= Copy: Competitor watch agent prompt
You are my competitive intelligence agent. Build a repeatable workflow that checks public information about my competitors, spots meaningful changes since the last run, updates a shared log and tells me what I can act on. Use connected apps, reusable skills and scheduled routines where they're available.

1. Set up the watchlist
My business: [NAME] | My offer: [DESCRIPTION] | Competitors: [FIVE NAMES + WEBSITES] | Watch for: pricing, product launches, positioning, partnerships, hiring and policy changes | Log: [GOOGLE SHEET/NOTION/AIRTABLE] | Alerts: [EMAIL/SLACK]
Treat this list as final. Ask me if a company name is unclear.

2. Collect evidence every run
Check each competitor's website, pricing and product pages, release notes and public announcements. Record the link, the time you checked, figures only when clearly shown and a short quote as evidence. Respect logins and paywalls. Never try to get around them.

3. Spot real changes
Compare with the last saved check. Separate what's new from what you already knew, and mark each change as confirmed, likely or unconfirmed. Ignore small wording edits, repeated press coverage and noise. Pick up to five changes, ranked by how much they could affect my business.

4. Update the log
Keep one current profile per competitor plus a dated change log: what changed, before, after, links, how sure you are, what it likely means and the next step you'd suggest. Keep the history. Make sure a retry never adds the same change twice.

5. Flag what matters
When a change is [HOW BIG IT NEEDS TO BE], create a review task in [TASK TOOL] and draft a short alert to [EMAIL/SLACK]: the change, the evidence, what it means and who should own it. Never change my pricing, marketing or sales materials without my approval.

6. Schedule and check
After a successful test, save this as a reusable skill where you can, and schedule it for every Monday at 7am New York time. If that isn't possible, use another authorised way and tell me which. Test it on two competitors first: check a snapshot is saved, a real change is spotted, the task is created, the alert is delivered and the next run is scheduled. Then send me a Monday brief: sources, key changes, decisions needed and errors.

Start by checking which tools you can use, do a safe test on two competitors, then set up the schedule. Keep what's done separate from draft alerts, missing connections and approvals waiting on me.
=$tr$,
   null),
  ($tr$text$tr$, $tr$How you know your agent works$tr$, 90,
   $tr$• The schedule exists, and you can see when it runs next.
• It used real information, from sources it's allowed to use.
• It changed something real in one of your tools, and you can click the link to see it.
• Anything sent or published is either confirmed, or clearly marked "awaiting approval".
• Retries, duplicates and errors are logged, not hidden.

Prompts by Cien Solon.$tr$,
   null),
  ($tr$text$tr$, $tr$This week's calls$tr$, 92,
   $tr$• Wed 18 Nov, 12pm ET: Networking Session. Meet the cohort.
• Fri 20 Nov, 12pm ET: Q&A with an exited founder.
• Today's replay with Cien goes in Time Rich Replay once it's recorded.$tr$,
   null);

update public.portal_items i
   set kind = w.kind, body = w.body, url = w.url, sort = w.sort, published = true
  from want w
 where i.week_id = 4 and i.title = w.title;

-- new rows
insert into public.portal_items (week_id, kind, title, body, url, sort, published)
select 4, w.kind, w.title, w.body, w.url, w.sort, true
  from want w
 where not exists (select 1 from public.portal_items i
                    where i.week_id = 4 and i.title = w.title);

-- everything else in Week 4 comes off the page (kept, not deleted)
update public.portal_items i
   set published = false
 where i.week_id = 4 and i.published
   and not exists (select 1 from want w where w.title = i.title);

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items where week_id = 4 and published;
  if v <> 8 then raise exception 'expected 8 published rows in Week 4, found %', v; end if;
end $$;

commit;

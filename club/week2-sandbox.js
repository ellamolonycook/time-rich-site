/* Time Rich accelerator portal - Week 2, as a draft for the sandbox.
 *
 * The weeks come from Supabase, and the sandbox reads the same database as
 * timerich.ai, so a row added there is a row members get. This keeps the
 * draft out of the database: on a sandbox host it writes Week 2 into the
 * page's copy of the portal data, before anything draws it. On any other
 * host it does nothing at all, so timerich.ai is unchanged even if this file
 * ships there.
 *
 * The body format is the one rows use in Supabase (curriculum.html,
 * bodyParts): "= Copy..." opens a copy box, "| a | b |" is a table, "+ Name"
 * is a drop-down. A row's sort picks its section, as in Week 1.
 *
 * Ticks work on the page but are never sent: these rows have no id in the
 * database. They clear on a reload.
 *
 * To put Week 2 live, the rows and sections below become a migration and
 * this file and its script tag go.
 */
(function () {
  var host = window.location.hostname;
  var sandbox = /(^|\.)time-rich-site\.pages\.dev$/.test(host) ||
    host === 'localhost' || host === '127.0.0.1';
  if (!sandbox) return;

  var TITLE = 'Week 2: ☎️ Time Rich OS for founders becoming CEOs';
  var SUMMARY = 'Time Rich OS is one framework: RICH. Four letters, one question each.';

  var SECTIONS = [
    { upto: 19, title: 'Your Time Rich OS' },
    { upto: 29, title: 'How this week runs' },
    {
      upto: 39,
      title: '1. Build conviction by eliminating (R: Revenue)',
      lead: `"If you can go door to door and sell, you can do anything." Mark Cuban

Conviction comes from cutting, not adding. Every lead, idea and task is either a distraction or a conviction. Cut the distractions and you're left with a short list of the right people, one number and one offer. That's when selling stops feeling like pushing.`
    },
    {
      upto: 49,
      title: '2. Delegate (H: Hand-off)',
      lead: `"AI doesn't know the consequences of its actions. AI doesn't have inherent ethics." Mark Cuban. That's why AI drafts and you decide.

Every morning, speak your to-do list into Wispr Flow and paste it in. The AI decides what needs you and briefs the rest.

Delegation mindset shift
Delegating doesn't mean giving everything away. It starts with one question: does this need my expertise? If yes, it's your IP, so keep it. If not, it goes to AI, to someone who can learn it, or gets handed off ahead of time instead of at the last minute. Most founders hold on because "it's quicker if I just do it." It's quicker once. It's slower every week after that. And if your company needs you for everything, you're the one blocking its growth.`
    },
    {
      upto: 59,
      title: '3. Save it as a skill (I: IP)',
      lead: `"You've got to find one thing and be great at it. Because once you're great at something, doors open up wide." Mark Cuban

Anything you've done twice should never need you again. A skill is your way of doing it, saved so AI or a person runs it by name. This is your IP.`
    },
    { upto: Infinity, title: 'This week, and what you\'ve built' }
  ];

  var ROWS = [
    {
      sort: 10,
      title: 'RICH: four letters, one question each',
      body: `| Letter | The question | This week |
| R: Revenue | Is money coming in without you chasing it? | One daily number and today's list |
| I: IP | Is what you know written down? | Your first skill |
| C: Crew | Who does the work, and who's in your corner? | Your Sales Floor intern |
| H: Hand-off | Is it out of your head and off your plate? | Morning delegation: Done, Know, When |

Get all four running and the business stops running through you. That's Time Rich. Week 1 was the foundation: your AI set up, Wispr Flow installed, your Business COMPASS and your ICP. This week you start all four letters.

Why this week looks like this
57 of you ranked more revenue as your number one goal. 47 of you don't do outreach every day. So this week is about one thing: money coming in on a rhythm, run by a system instead of by you.`
    },
    {
      sort: 12,
      title: 'Your Superhuman OS in Notion',
      body: `This is the Notion workspace we built for you. It's the fundamentals of Time Rich OS, already set up. It's a frame, not a finished house: go in and make it yours. Rename pages, delete what you don't use, add what your business needs.

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
• H: Hand-off: a Tasks Google Sheet.`
    },
    {
      sort: 14,
      title: 'CEO mindset shift: one system first',
      body: `Your systems will keep changing as your business changes. What works at $10K a month breaks at $50K, and that's normal. So don't get caught building a beautiful system for a business that isn't making money yet. Delivery matters, but cash flow matters more.

Right now, focus on one system: sales and partnerships. Your CRM, your daily list and the people who can send you business. Build the rest when money is coming in on a rhythm and you can see what actually needs a system.`
    },
    {
      sort: 16,
      title: 'This week: from founder to CEO',
      body: `Founders do the work. CEOs build the thing that does the work, and only show up where they're actually needed.

| Founder | CEO |
| Sells when there's time | Wakes up to a number and a list already drafted |
| Keeps every task in their head | Briefs it once: Done, Know, When |
| Does the same job again next week | Saves it as a skill and never does it again |
| The business can't run without them | Their IP needs them. The company doesn't. |

Superhuman is the start. Becoming Time Rich takes a different kind of discipline, the boring kind, where you run this every single day for months until you stop noticing you're doing it. Nobody gets there without the foundation, and this week is the foundation.`
    },
    {
      sort: 20,
      title: 'Three moves, five prompts',
      body: `The AI drafts everything; you approve it and hit send.

Copy and paste each prompt into your Sales Floor project in Claude. No Sales Floor project yet? Create one in Claude called Sales Floor. Use Wispr Flow for everything you say back: your answers, your brain dump, your voice notes.

+ Not B2B?
Your Sales Floor already knows who your leads are. DTC: stockists, creators and press. Apps: beta users and partners. Marketplaces: sellers first. Coaches: your people live in DMs, so drafts go in Notes and there's no web research on private people.`
    },
    {
      sort: 22,
      title: 'First 5 minutes of the call',
      body: `Nobody has time before the call, so we do this together at the start.

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
- Tell me what you learned about me that should be saved to my Business COMPASS. Show me first. Never edit section 9.
=`
    },
    {
      sort: 30,
      title: 'Prompt 1. Set up your Sales Floor, your first Crew member (C: Crew)',
      body: `Paste once into the project instructions.

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
=`
    },
    {
      sort: 32,
      title: 'Prompt 2. Move your people into one CRM (live)',
      body: `= Copy: Prompt 2
Using my Sales Floor rules for who counts as a lead:
1. If I have a Hot + Warm Contacts page from Week 1, start with everyone on it. Then search my Gmail for anyone not already on it, from the last 90 days (sent mail and replies first) for real people who could be a lead, client, past client, partner or investor. Skip newsletters, receipts, notifications, cold pitches, anything automated, and anything personal, family, health or government. Stop at 50.
2. Then I'll talk through the people in my head. Add them with Source "Brain dump".
3. Merge duplicates. For each person: name, email, company, role, how we're connected, last contact, any open loop, Source, Type (Lead, Hot Lead, Client, Partner, Investor, Stockist, Creator, Beta user or Other) and Stage (New, Contacted, Replied, Call booked, Won, Lost or Nurture), based only on what you can see.
4. Show me the table and the count by Type. When I say go, add them to my CRM in batches of 25 with Status Draft. Then mark my top 10 as Hot Lead, with one line on why each, and tell me who to stop chasing and why.

Rules: only use what you can see or what I tell you. Don't draft or send anything.
=`
    },
    {
      sort: 34,
      title: 'Prompt 3. Your daily number and today\'s list (live, then every weekday)',
      body: `= Copy: Prompt 3
Read my Business COMPASS (section 3 for my offer and price, section 9 for my goal) and my CRM.

1. Work backwards from my goal this month to one number: how many people I need to reach each working day. If I sell on calls: goal ÷ price ÷ close rate ÷ booking rate ÷ working days left. If I sell a product, an app or a marketplace, work back from orders, sign-ups or active sellers instead. Pre-revenue: set the goal in active users or conversations, not dollars. Ask me for any number you don't know, mark guesses (guess), and show the sums. Tell me in one line if it's realistic. Give me a line that starts "Daily outreach:" for me to paste into section 9 myself.

2. Build today's list with that many people, in this order: open loops (people waiting on me, or no reply after 5 days), then past clients I haven't spoken to in 60 days (ask how they are and who they know who needs my offer), then Hot Leads. For each: why today, and a message in my voice under 90 words with one real reason to reach out. Save as Gmail drafts in the original thread, or in Notes for LinkedIn and DM contacts.

Every weekday after this, when I say "today's list", run step 2 only.

Rules: never send. Never invent a reason to reach out. Never edit section 9.
=`
    },
    {
      sort: 40,
      title: 'Prompt 4. Morning delegation (any morning your to-do list is full)',
      body: `= Copy: Prompt 4
You are my delegation partner. Below is my morning voice note. Read my Business COMPASS first.
For each task:
1. Does this need my expertise? If yes, it's my IP: keep it with me. If not, say who it's for: AI, a person to learn it, or a person to hand it to.
2. Brief it: Done (what does done look like?), Know (what do they need to know?), When (the due date, and once or every week). If one is missing, ask me ONE short question. If I can't answer Done, tell me it isn't ready to delegate.
3. Show me the list. After my yes, add each task to my Tasks database in Notion: Task Name, Assigned To, Due Date, Notes (the brief), Status Draft.
4. If the owner is AI, do it now and show me the draft. If it's a person, draft a short message with their brief for me to send.
Rules: drafts only. Never send. Never invent a task, date or detail. If you don't know, write "Needs input".
My voice note is below:
=`
    },
    {
      sort: 50,
      title: 'Prompt 5. Friday: turn this week into skills',
      body: `= Copy: Prompt 5
Read my Tasks from this week, my CRM, and the messages I sent this week (Gmail Sent).
1. Turn how I do outreach into a skill: a name, the one line I say to run it, when to run it, what it reads, the steps, what good looks like (2 examples from my real sent messages; if there are none, write "Needs input"), and rules: never send, never invent, drafts only.
2. If I delegated tasks this week, find the one that came up most and turn it into a skill the same way. If I didn't, skip this step.
3. Show me what you wrote. After my yes, save each as a row in Skills (Status Draft, Trigger = the one line). Then give me one line to add to my Sales Floor instructions: "When I say a skill's Trigger, open that row in Skills and follow it."
Rules: don't create a new page or database. Never invent an example or a result.
=`
    },
    {
      sort: 60,
      title: 'This week',
      body: `Two things, plus one story. That's it.

• Every weekday, 10 minutes: say "today's list", approve, send.
• Friday 6 Nov: Prompt 5. Post in #audacious-wins: your daily number, one reply you got, and your skill's name.
• For ViKA, Mon 9 Nov: one story rep, saved as a Wispr Flow note. The moment you knew you couldn't keep doing it all yourself.

Morning delegation is there whenever you have a full to-do list. Use it when you need it, not because it's homework.

Want more? Calendar, LinkedIn, pipeline review, Friday scorecard and hiring prompts are in the portal library, open to every member.`
    },
    {
      sort: 62,
      title: 'One last thing: ego down, judgment up',
      body: `The system is the easy part. Getting out of your own way is the hard part. Three lessons from the Good American team, after the founders stepped back and brought in a CEO:

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
=`
    },
    {
      sort: 64,
      title: 'What you\'ve built: your Time Rich OS so far',
      body: `Time Rich OS for founders becoming CEOs. Your IP needs you. Your company shouldn't.

| RICH | Built this week | Founding Member ($350) | Inner Circle ($2.5K, by application) |
| R: Revenue | ✓ Daily number ✓ Today's list | Investor and super connector prompts | Offer and pricing pressure-tested with Ella |
| I: IP | ✓ Your first skill | Skills for every department, ViKA's story-to-selling library | Your story built into a talk |
| C: Crew | ✓ Your Sales Floor intern | Operations and Content interns, every expert replay | CEOs ahead of you, in the room every month |
| H: Hand-off | ✓ Morning delegation | Week 4: agents that run without you | Your hiring plan built with Ella |`
    }
  ];

  /* Far above any real row, so a draft tick can never name one. */
  var FIRST_ID = 9900000;
  ROWS.forEach(function (row, i) {
    row.id = FIRST_ID + i;
    row.kind = 'text';
    row.published = true;
  });

  /* The save goes nowhere for a draft row; anything else goes as normal. */
  function keepDraftTicksHere() {
    var api = window.TRPortal;
    if (!api || api.draftTicks) return;
    var save = api.setProgress;
    api.setProgress = function (target) {
      if (target && target.id >= FIRST_ID) return Promise.resolve(true);
      return save.apply(api, arguments);
    };
    api.draftTicks = true;
  }

  /* In place, in the first listener to run, so every other listener and
     every redraw from window.TR_PORTAL_DATA gets the same Week 2. */
  document.addEventListener('trportal:data', function (event) {
    var data = event && event.detail;
    if (!data || !Array.isArray(data.weeks)) return;
    keepDraftTicksHere();
    data.weeks.forEach(function (week) {
      if (Number(week.id) !== 2) return;
      week.title = TITLE;
      week.summary = SUMMARY;
      week.unlocked = true;
      week.items = ROWS;
      week.sections = SECTIONS;
    });
  });
})();

-- =====================================================================
-- Curriculum: Week 3, Visibility. The Content Workshop
-- (timerich.ai/contentworkshop) as a Club week, laid out like Week 1
-- (Ella, 29 Oct): the content strategy is the first step, then Stanley.
--
-- Five sections, by sort (club/curriculum.html, WEEK_SECTIONS[3]):
--   10-29  Step 1: Your content strategy
--   30-69  Step 2: Give Stanley your context
--   70-79  Step 3: Your LinkedIn skill
--   80-99  Step 4: Your first post
--   100+   Step 5: Switch on your rituals
--
-- Content only, the same way as the Week 1 migrations: rows are matched
-- on week and title, rewritten in place, new ones inserted, and any other
-- published row in week 3 unpublished (kept, not deleted). Safe to run
-- more than once. The three screenshots are in portal/assets.
-- =====================================================================

begin;

create temp table want (
  week_id integer, kind text, title text, sort integer, body text, url text
) on commit drop;

insert into want (week_id, kind, title, sort, body, url) values
  (3, $tr$text$tr$, $tr$Run the content strategy interview$tr$, 10,
   $tr$Your strategy comes first: every post Stanley writes later reads it. Mika's prompt asks you questions one at a time, and you leave with your content strategy file. Built on principles from Hannah Zhang (@itshannahzhang), product marketer and creator.

1. Open a new chat in your Business Hub (or ChatGPT).
2. Paste the prompt and send it.
3. Hold your Wispr key and answer out loud, like you're telling a friend. Messy is fine.

= Copy the prompt
You are a warm, sharp personal-brand strategist. Interview me, a person who may know nothing about personal branding or content, and at the end fill out my Personal Branding worksheet using my answers. The whole thing should take about 10 minutes.

## How to run the interview

- Start with a 2-sentence intro (about 10 minutes, 5 quick sections, you'll hand me a finished worksheet at the end), then ask my name and what I do today.
- Keep every message short and in plain language. Explain any term like "funnel" or "positioning" in one line.
- Do the heavy lifting for me: draft, suggest, and pre-fill, so I mostly react and edit instead of starting from a blank page.
- If an answer is vague, ask one quick follow-up for a real example, number, or result. Then move on.
- Never invent credentials, results, or stories. Only use what I told you.
- Tell me which section we're in (e.g. "Section 2 of 5").

## The sections, in order

### Section 1 · Your goal
Ask me to pick the ONE that matters most right now:
1. Growing my career (recruiters and better roles find me via inbound)
2. Pivoting my career (my content proves I belong in a new field before my resume does)
3. Earning money (brand deals, offerings)
4. Networking (access to people I could never cold-email)
5. Building a business (a founder brand that attracts customers, hires, investors)
6. A creative outlet (a place to explore things beyond my day job)

### Section 2 · Your topic Venn diagram
Explain in one line: your topic sits where four circles overlap. Then ask all four in a single message, so I can answer them together:
- PROOF: credibility you have that others don't (jobs, results, numbers, things you've built or lived through)
- DEMAND: what people already ask you about
- PERSON: who cares most about what you say (often a younger you)
- PASSION: what you'd talk about for an hour, for free
Then propose a one-line overlap ("what I could post about") and ask me to confirm or tweak it.

### Section 3 · Your positioning
Explain in one line: positioning is your topic, one level deeper, so the right person instantly thinks "that's for me."
Pre-fill the template using my answers so far, then ask me to make it my own (edit any line, or say "looks good"):
- FOR (who it's for, from PERSON)
- I AM A (who I am)
- WHO PROVIDES (the value or outcome I give)
- UNLIKE (the usual alternative people turn to)
- BECAUSE I BRING (my edge, from PROOF)
Once I confirm, combine it into one sentence I'd say out loud or put in my LinkedIn headline.

### Section 4 · Your content pillars
Explain the three pillars in one line each:
- Reach (top of funnel): brings new people in. Broad, easy-to-share topics.
- Trust (middle of funnel): turns viewers into followers. My story, opinions, how I think.
- Proof (bottom of funnel): turns followers into opportunities. Results, receipts, work shown in public.
Don't ask me to come up with these. Using everything so far, suggest a topic and a sample hook (the first line of a post that stops the scroll) for each pillar, specific to me. Ask me to keep, tweak, or swap any of them.

### Section 5 · Your platform and cadence
Ask in one message:
- Which platform (recommend one based on my goal and audience, with a one-line reason)
- How many posts per week I can sustain on a busy week, not my best week
- What day and time I'll protect to write or film
If my number sounds like a best-week number, push back once.

## Final output
Fill in the worksheet below using my words wherever possible. Output it as ONE markdown code block so I can copy it and paste it straight into my Notion page. Mark the goal I picked with [x] and leave the rest as [ ]. Keep every heading and label exactly as written. Don't add commentary inside the block.

# Personal Branding

## Your Goal
- [ ] Growing my career (recruiters and better roles find me via inbound)
- [ ] Pivoting my career (my content proves I belong in a new field before my resume does)
- [ ] Earning money (brand deals, offerings)
- [ ] Networking (access to people I could never cold-email)
- [ ] Building a business (a founder brand that attracts customers, hires, investors)
- [ ] A creative outlet (a place to explore things beyond my day job)

## Part 1 · Your topic Venn diagram
**PROOF: credibility you have that others don't:** ...
**DEMAND: what people already ask you about:** ...
**PERSON: who cares most about what you say:** ...
**PASSION: what you'd talk about for an hour, for free:** ...
**The overlap, in one line, what I could post about:** ...

## Part 2 · Your positioning
**FOR** ...
**I AM A** ...
**WHO PROVIDES** ...
**UNLIKE** ...
**BECAUSE I BRING** ...

**My positioning, in one sentence:** ...

## Part 3 · Your content pillars
**Reach · top of funnel**
Topic: ...
Sample hook: "..."

**Trust · middle of funnel**
Topic: ...
Sample hook: "..."

**Proof · bottom of funnel**
Topic: ...
Sample hook: "..."

## Your platform and cadence
**Platform:** ...
**Posts per week I can sustain on a busy week:** ...
**When I'll write or film (day and time I'm protecting):** ...

After the block, tell me to paste the worksheet into my Notion page.

Start the interview now.
=$tr$,
   null),
  (3, $tr$text$tr$, $tr$Save your content strategy$tr$, 20,
   $tr$At the end the interview hands you your worksheet as one block.

1. Paste it into a Notion page called Content Strategy.
2. Add it to your Business Hub's Files too, so every chat there can read it.

You'll drop the same file into Stanley in Step 2.$tr$,
   null),
  (3, $tr$link$tr$, $tr$Get 6 months of Stanley free$tr$, 30,
   $tr$Stanley is your AI head of content. Your accelerator includes 6 months free with code TIMERICH6.

Video: https://www.loom.com/share/be6db9ceb94344afb9b56244c9e517f2

Before you start: don't click "Message Stanley" on the homepage. That route skips the promo code. Go in through email first. You can connect iMessage, WhatsApp or Telegram later.

1. On your laptop, go to getstanley.ai with the button below.
2. Click Log in (top of the page, not "Message Stanley").
3. Click Sign up.
4. Choose Sign up with email or Google. Ignore the iMessage option on this screen.
5. Enter your email and create a password. Use the email you want tied to your account. Click Continue.
6. Verify your email. Check your inbox for a login code and enter it.
7. Answer the duplicate account check. If you've never texted Stanley before, click No, I'm new to Stanley. The next page can take a few seconds to load.
8. Pick the $49/month plan. Click Start your 14-day free trial. Checkout opens.
9. Click Pay without Link to pay by card.
10. Click Add promotion code, enter TIMERICH6 and click Apply. You should see 100% off for the next 6 billing cycles.
11. Enter a payment method and click Start trial. You won't be charged during the 6 free months.

+ Already on Stanley's free plan?
1. Log in at getstanley.ai.
2. Go to Upgrade and pick the $49/month plan. Click Start your 14-day free trial. Checkout opens.
3. Click Pay without Link to pay by card.
4. Click Add promotion code, enter TIMERICH6 and click Apply. You should see 100% off for the next 6 billing cycles.
5. Enter a payment method and click Start trial. You won't be charged during the 6 free months.$tr$,
   $tr$https://x.getstanley.ai/r/mz4y9g$tr$),
  (3, $tr$text$tr$, $tr$Drop in your strategy$tr$, 40,
   $tr$Stanley writes in your voice once it knows you. In Stanley, go to Brain, then Files, and click + to add the content strategy file from Step 1.

! /portal/assets/visibility-stanley-files.png | Stanley's Brain panel: the Files section is open with a + button beside it, and two files listed under it.$tr$,
   null),
  (3, $tr$text$tr$, $tr$Connect your tools$tr$, 50,
   $tr$In Stanley's Connectors, add Slack, your calendar, email, the platforms you already post to, and Wispr Flow Notetaker for your meetings. Record, with everyone's OK.

! /portal/assets/visibility-stanley-connectors.png | Stanley's Connectors screen, with the apps grouped into Core, Meetings, Newsletters and Other. Connected ones carry a green tick.$tr$,
   null),
  (3, $tr$text$tr$, $tr$Add your past content$tr$, 60,
   $tr$Optional, and worth it: existing posts, newsletters, your website, or other people's posts you take inspiration from. More context, better tone.$tr$,
   null),
  (3, $tr$text$tr$, $tr$Add the linkedin-content skill to Stanley$tr$, 70,
   $tr$A skill is a saved set of instructions Stanley follows every time you ask. This one collects your context, interviews you, offers five angles and five hooks, drafts in your voice and scores the post for shareability and curiosity.

1. Copy the skill below, the whole thing.
2. In Stanley, go to Brain, then Skills, click + and name it linkedin-content. The name matters: it's what you call in Step 4.
3. Paste the skill in and save it.

! /portal/assets/visibility-stanley-skills.png | Stanley's Brain panel: the Skills section is open with a skill named linkedin-content under it.

= Copy the skill
# Create LinkedIn Content

Help the user turn a topic into a short LinkedIn post in approximately 10 minutes.

Use relevant context files and available connectors to understand their content strategy, audience, voice, and existing content. Keep the workflow conversational and concise.

Do not write the full post until the user has selected an angle and hook, unless they explicitly ask to skip ahead.

## 1. Read context and get the topic

Find and read the relevant content strategy file first. Follow its references to audience and voice guidance where available.

Review three to five relevant past posts. Prefer examples with performance data or explicit user approval. Learn from their openings, specificity, rhythm, and storytelling without copying them.

Distinguish measured performance from editorial judgment. Never describe a post as high-performing without evidence.

Use the topic or notes the user provided. Ask for a topic only if none was supplied.

If a context source is unavailable, acknowledge the gap briefly and proceed with accessible material. Ask only for information necessary to continue; do not let research consume the session.

## 2. Run a short interview

Budget approximately three minutes for context gathering and the interview combined.

Ask up to three questions together, covering what is still missing:

- Who is this for, and what should they think, feel, or do afterward?
- What is the main takeaway or opinion?
- What story, example, observation, or result supports it?

Adapt the questions to the topic. Invite rough bullets or conversational answers. Do not repeat questions already answered in the user's notes or context.

Use at most one brief follow-up round with one or two questions to uncover specifics or clarify the claim. Examples:

- What happened that made you realize this?
- What was different from what you expected?
- Can you give one concrete example?
- Is that something you observed or your interpretation?
- What would be overstating your point?

Do not force a personal story, framework, lesson, or dramatic turning point. An opinion, observation, announcement, or useful explanation can stand on its own.

Stop when there is enough substance. Reflect the core point in one sentence before presenting angles. Clearly label proposed interpretations; do not add a separate confirmation round.

## 3. Present five angles and flows

Budget approximately two minutes, including the user's choice.

Offer five genuinely different approaches. Vary the central argument, reader payoff, or narrative approach, rather than rephrasing the same idea.

For each option, provide:

- A short name and the point the reader takes away.
- A one-line flow: opening, then development or evidence, then ending.

Keep each option to two short lines. Use available material and identify any missing evidence instead of inventing it.

Recommend one angle with a one-sentence reason.

Wait for the user to choose, combine, or revise an angle.

## 4. Present five hooks and recommend length

Budget approximately two minutes, including the user's choice.

Write five distinct hooks for the selected angle, each one or two short lines.

Use effective patterns from the user's existing content where available. Adapt the pattern to the topic without copying old wording or claiming unsupported performance.

Each hook should:

- Make the topic relevant to the intended audience.
- Introduce a specific situation, tension, observation, or promise.
- Give a clear reason to keep reading.
- Create curiosity the body will satisfy.
- Match the user's voice.

Avoid vague cliffhangers, fabricated numbers, fake controversy, unsupported claims, and recycled “nobody talks about this” openings.

Recommend one hook with a brief reason.

In the same message, suggest the shortest suitable length:

- 80 to 120 words for a compact observation or opinion.
- 120 to 180 words by default.
- 180 to 250 words when the story or explanation needs room.

These are editorial guidelines, not performance guarantees. If the user selects only a hook, use the recommended length.

Wait for the user's hook selection before drafting.

## 5. Draft and remove AI-writing patterns

Budget approximately three minutes for drafting, editing, and scoring combined.

Use the selected angle, flow, hook, and length. Keep one main point. Deliver the hook's promise with concrete support and minimal setup.

Apply the following principles while writing, then silently edit the draft before showing it:

- Preserve the user's vocabulary, opinions, humor, uncertainty, and natural rhythm.
- Use plain words, concrete details, and direct verbs.
- Cut generic introductions, filler, corporate language, and inflated importance.
- Avoid stock phrases such as “delve,” “game changer,” “in today's world,” and “it's worth noting.”
- Avoid formulaic contrasts such as “It's not about X. It's about Y.”
- Cut fake-insight setups such as “Here's what nobody tells you.”
- Avoid forced groups of three, identical paragraph shapes, excessive em dashes, and stacked dramatic fragments.
- Let evidence demonstrate the point rather than declaring it important or surprising.
- Keep useful nuance, honest uncertainty, and distinctive sentences.
- Cut fake-profound endings and unnecessary recaps.
- Never invent experiences, dialogue, emotions, results, or facts to make writing feel human.

Treat these as editing principles, not a mechanical blacklist. Preserve natural expression and accurate meaning.

Use plain text and natural paragraph breaks suitable for LinkedIn. Include lists only when helpful. Follow known preferences for emojis and hashtags; otherwise omit them.

Do not require a named framework, “TAKEAWAY:” label, personal tagline, or CTA. End naturally. Include a question or CTA only when it serves the post.

## 6. Score and deliver

Evaluate the draft for the intended audience:

**Shareability: 1 to 5**

Would this reader send it to someone or share it publicly because it is useful, relatable, or expresses something they care about?

**Curiosity: 1 to 5**

Does the opening create a specific reason to continue, and does the body reward that interest?

Use this scale:

- 1: Weak.
- 2: Needs substantial work.
- 3: Solid but ordinary.
- 4: Strong.
- 5: Exceptional for this audience.

Scores are editorial judgments, not predictions of reach. Do not inflate them.

If either score is 3 or lower, make one focused revision before presenting the draft. If improvement requires missing facts, identify the gap instead of inventing them. Avoid repeated revision loops.

Return:

1. The finished post, ready to copy.
2. Word count and intended audience.
3. Shareability score with one short reason.
4. Curiosity score with one short reason.

Keep the assessment brief and outside the post.

## Working rules

- Target a 10-minute session, including user replies, without promising an exact duration.
- Keep explanations short and batch questions.
- If time runs short, reduce optional follow-ups and commentary. Do not silently select an angle or hook.
- Respect requests to skip, combine, or revisit stages.
- Preserve the chosen direction during revisions unless the user requests a change.
- Never publish or schedule without explicit user instruction.
=$tr$,
   null),
  (3, $tr$text$tr$, $tr$Pick a topic that matches your goal$tr$, 80,
   $tr$Choose a topic for the part of the funnel you need most right now, and take one of the three.

+ Top of funnel: be discovered
Help new people discover you.
1. Relatable frustration: plenty of ideas, until you open a blank draft.
2. Opinion: your best content is hiding in your clients' questions.
3. Personal story: why I waited so long to share my work publicly.

+ Middle of funnel: be trusted
Build trust in your expertise.
1. How-to: turn one customer conversation into five post ideas.
2. Teardown: how I'd rewrite a weak LinkedIn hook, and why.
3. Lesson learned: what changed when I started interviewing clients before writing.

+ Bottom of funnel: be chosen
Help someone choose you.
1. Client result: how I helped a client get a clear result.
2. Your process: what the first week of working with me looks like.
3. Buying decision: when to hire someone like me versus do it yourself.$tr$,
   null),
  (3, $tr$text$tr$, $tr$Draft your first post with Stanley$tr$, 90,
   $tr$Call your skill with one line about your topic, answer its interview with Wispr, and refine the draft. Drafting is the win: post when it feels like you.

= Copy: Say this to Stanley
Use my linkedin-content skill. My topic:
=

When it's live, share it in #audacious-wins in the Time Rich Club Slack.$tr$,
   null),
  (3, $tr$text$tr$, $tr$Switch on two rituals$tr$, 100,
   $tr$LinkedIn only, to keep it simple. In Stanley, switch on two of these and it runs them for you:

1. Repurpose Winners: takes your best-performing posts and turns them into fresh ones.
2. Repackage Old Posts: brings back old posts that still hold up, rewritten for today.
3. Good Morning: a daily read of what's moving in your world, with post ideas. Start here if you have no posts yet.$tr$,
   null);

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

-- everything else in week 3 comes off the page (kept, not deleted)
update public.portal_items i
   set published = false
 where i.week_id = 3 and i.published
   and not exists (select 1 from want w where w.week_id = i.week_id and w.title = i.title);

do $$
declare v integer;
begin
  select count(*) into v from public.portal_items where week_id = 3 and published;
  if v <> 10 then raise exception 'expected 10 published rows in Week 3, found %', v; end if;
  select count(*) into v from public.portal_items
   where week_id = 3 and published and (coalesce(body, '') || title) ~ '(→|—|–|TBC)';
  if v <> 0 then raise exception '% published Week 3 rows still have an arrow, a long dash or TBC', v; end if;
  select count(*) into v from public.portal_items
   where week_id = 3 and published and sort = 10 and body like '%= Copy the prompt%';
  if v <> 1 then raise exception 'the content strategy interview is not the first step'; end if;
  select count(*) into v from public.portal_items
   where week_id = 3 and published and title = 'Get 6 months of Stanley free'
     and url = 'https://x.getstanley.ai/r/mz4y9g' and body like '%TIMERICH6%';
  if v <> 1 then raise exception 'the Stanley step is missing its link or code'; end if;
  select count(*) into v from public.portal_items
   where week_id = 3 and published and body like '%= Copy the skill%' and body like '%# Create LinkedIn Content%';
  if v <> 1 then raise exception 'the linkedin-content skill is missing'; end if;
end
$$;

commit;

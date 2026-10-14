# Prompt Library: the draft, second pass

Draft only. Nothing is built and nothing is committed.

Each card is three parts at most: the skill, one line on what it does, and
the trigger phrase to copy. A card gets an autopilot brief only when a
schedule can really run from email, calendar, Notion or call notes.

Changes from the first pass:

- Go deeper is gone, and so are the long Start prompts. The trigger phrase
  is the Start.
- No prompt opens with "Start from my Business COMPASS" any more.
- Only skills with a working download are shown. I checked all 14 links in
  `portal/skills.json` and every one returns 200.
- Audit my AI is gone, from the cards and from the missing list.
- The COMPASS trigger is now "Superhuman: build my context".
- Card text says "your AI", not "Claude", except inside a skill name.

Copy rules still hold: plain English, short sentences, no em dashes, no
double dashes, no hype.

---

## 1. The 14 cards

| # | Skill | Trigger phrase | Where the phrase came from | Autopilot |
| - | ----- | -------------- | -------------------------- | --------- |
| 1 | Build my context (`compass-superhuman`) | Superhuman: build my context | set by Ella | yes |
| 2 | Audit my LinkedIn (`audit-linkedin-for-icp-goal`) | Audit my LinkedIn against my goal and my ICP | picked | no |
| 3 | Optimise my profile (`linkedin-profile-optimizer`) | review my profile | exact | no |
| 4 | Plan my week (`linkedin-content-planner`) | plan my week | exact | yes |
| 5 | Write a post (`linkedin-post-writer`) | write a post | picked | yes |
| 6 | Break down a hook (`linkedin-hook-extractor`) | break down this hook | picked | no |
| 7 | Humanise a draft (`linkedin-humanizer`) | humanize this | exact | yes |
| 8 | Repurpose something (`linkedin-repurposer`) | repurpose this for LinkedIn | picked | yes |
| 9 | Interview me (`linkedin-interviewer`) | interview me | exact | yes |
| 10 | Comment on a post (`linkedin-comment-drafter`) | draft me a comment | exact | no |
| 11 | Clear my comments (`linkedin-reply-handler`) | clear the comments on this post | picked | no |
| 12 | Find my warm threads (`linkedin-thread-monitor`) | what threads need follow-up | exact | no |
| 13 | Who engaged (`linkedin-engager-analytics`) | who liked my post | exact | no |
| 14 | Get the team posting (`linkedin-employee-advocacy`) | get the team posting | exact | no |

"exact" means the phrase is quoted in that pack’s own SKILL.md. "picked"
means I chose one from what the description says the skill is for, so those
six are the ones to check. `audit-linkedin-for-icp-goal` has no pack in the
repo, so its phrase is a guess from the skills.json description alone.

---

### 1. Build my context

`compass-superhuman` · Superhuman · Week 1

Builds your Business COMPASS from your own calls, docs, email and Notion, then shows where your time goes.

**Say this**

```
Superhuman: build my context
```

**Put it on autopilot**

```
Job: Keep my Business COMPASS current.
Reads: My Business COMPASS, my last two weeks of call notes, and my email.
Does: Finds anything in recent calls or email that contradicts or adds to the COMPASS.
Delivers: A draft update in my Notion workbook, section by section, with the source for each change.
Never: send, post or publish anything. Draft only, and wait for me.
Runs: Sunday, 6pm.
```

### 2. Audit my LinkedIn

`audit-linkedin-for-icp-goal` · LinkedIn

Scores your LinkedIn profile against one 90 day goal and one ideal client, then gives you ranked fixes with drafts.

**Say this**

```
Audit my LinkedIn against my goal and my ICP
```

No autopilot. Needs your live profile, so there is nothing to read on a schedule.

### 3. Optimise my profile

`linkedin-profile-optimizer` · LinkedIn

Rewrites your whole LinkedIn profile, from the headline to the recommendations.

**Say this**

```
review my profile
```

No autopilot. Needs your live profile, so there is nothing to read on a schedule.

### 4. Plan my week

`linkedin-content-planner` · LinkedIn

Builds a seven day LinkedIn plan with a pillar, a format and a hook for each day.

**Say this**

```
plan my week
```

**Put it on autopilot**

```
Job: Plan next week on LinkedIn.
Reads: My Business COMPASS, my pillars and my content plan in Notion.
Does: Builds the seven day plan and balances the pillars.
Delivers: A draft plan in the Content Hub page of my Notion workbook.
Never: send, post or publish anything. Draft only, and wait for me.
Runs: Sunday, 4pm.
```

### 5. Write a post

`linkedin-post-writer` · LinkedIn

Writes a LinkedIn post from scratch using a proven hook, then takes the AI tells out of it.

**Say this**

```
write a post
```

**Put it on autopilot**

```
Job: Draft tomorrow’s post from my plan.
Reads: My content plan, my story bank and my content guardrails in Notion.
Does: Writes the post for tomorrow’s slot and runs the humaniser pass over it.
Delivers: A draft in the Content Hub page of my Notion workbook.
Never: send, post or publish anything. Draft only, and wait for me.
Runs: Weekdays, 6am.
```

### 6. Break down a hook

`linkedin-hook-extractor` · LinkedIn

Takes a post that worked and tells you which hook formula it used, and why.

**Say this**

```
break down this hook
```

No autopilot. Needs a post URL you hand it, so there is nothing to read on a schedule.

### 7. Humanise a draft

`linkedin-humanizer` · LinkedIn

Takes the AI tells out of a draft, and audits a post before you publish it.

**Say this**

```
humanize this
```

**Put it on autopilot**

```
Job: Audit every draft waiting in my Content Hub.
Reads: My voice profile and my drafts in Notion.
Does: Scores each draft and rewrites the lines that read as AI.
Delivers: Draft rewrites in my Notion workbook, next to the original.
Never: send, post or publish anything. Draft only, and wait for me.
Runs: Weekdays, 5am.
```

### 8. Repurpose something

`linkedin-repurposer` · LinkedIn

Rebuilds a tweet, video, blog or newsletter as a native LinkedIn post.

**Say this**

```
repurpose this for LinkedIn
```

**Put it on autopilot**

```
Job: Repurpose my newest long piece.
Reads: My Content Library and my content guardrails in Notion.
Does: Finds the newest piece I have not repurposed and rebuilds it for LinkedIn.
Delivers: A draft in the Content Hub page of my Notion workbook.
Never: send, post or publish anything. Draft only, and wait for me.
Runs: Wednesday, 7am.
```

### 9. Interview me

`linkedin-interviewer` · LinkedIn

Interviews you for the raw material your posts are made of.

**Say this**

```
interview me
```

**Put it on autopilot**

```
Job: Ask me one interview question.
Reads: My Business COMPASS and my story bank in Notion.
Does: Finds the thinnest part of my story bank and writes one question for it.
Delivers: A draft question in my Notion workbook, for me to answer in my own time.
Never: send, post or publish anything. Draft only, and wait for me.
Runs: Tuesday, 8am.
```

### 10. Comment on a post

`linkedin-comment-drafter` · LinkedIn

Drafts a comment on someone else’s post, in your voice.

**Say this**

```
draft me a comment
```

No autopilot. Needs live posts from your feed, so there is nothing to read on a schedule.

### 11. Clear my comments

`linkedin-reply-handler` · LinkedIn

Drafts a reply to one comment, or sweeps a whole post and replies to every comment worth answering.

**Say this**

```
clear the comments on this post
```

No autopilot. Needs live comments on your posts, so there is nothing to read on a schedule.

### 12. Find my warm threads

`linkedin-thread-monitor` · LinkedIn

Tracks which of your comments got a reply, and flags the ones worth following up now.

**Say this**

```
what threads need follow-up
```

No autopilot. Needs live replies on LinkedIn, so there is nothing to read on a schedule.

### 13. Who engaged

`linkedin-engager-analytics` · LinkedIn

Pulls everyone who liked or commented on a post and sorts them by how well they fit your ideal client.

**Say this**

```
who liked my post
```

No autopilot. Needs live engagement from LinkedIn, so there is nothing to read on a schedule.

### 14. Get the team posting

`linkedin-employee-advocacy` · LinkedIn

Sets up and runs a LinkedIn program for your team, from the launch plan to the numbers.

**Say this**

```
get the team posting
```

No autopilot. The only job worth scheduling here is a team report, and that needs the team’s live LinkedIn posts. Flagged for you: this one was not on your list, but the same rule applies.

---

## 2. The skills with no download

These are in `portal/skills.json` with a description, and nothing to
download. They get no card until there is a file behind them.

| Skill | Trigger phrase in skills.json |
| ----- | ----------------------------- |
| Lock down my Claude (`security-superhuman`) | Superhuman: lock down my Claude |
| Set my goal (`superhuman`) | Superhuman: set my goal |
| Build my reply skill (`replies-superhuman`) | Superhuman: build my reply skill |
| Revenue (`revenue-superhuman`) | Superhuman: revenue |
| Find my hooks (`hooks-superhuman`) | Superhuman: find my hooks |
| Build my story bank (`story-superhuman`) | Superhuman: build my story bank |
| Task for (`superhuman-delegate`) | Task for ___ |
| Build my follow-up agent (`follow-up-agent`) | Superhuman: build my follow-up agent |
| Map my channels (`channels-superhuman`) | Superhuman: map my channels |
| Pick my CTA (`cta-superhuman`) | Superhuman: pick my CTA |
| Build my ICP from calls (`build-icp-from-calls`) | (none set) |
| Set my content guardrails (`content-guardrails-superhuman`) | Superhuman: set my content guardrails |

Two notes on that list.

`story-superhuman` has no download in skills.json, but a public ZIP for it
is already live at `/downloads/story-superhuman.zip` and linked from
timerich.ai/os. It may only need the link pasting in.

`build-icp-from-calls` has no trigger phrase at all, so it needs one before
it can ever be a card.

---

## 3. The Guides row

One row under the cards. Six links into the member workbook, still waiting
on the URLs.

| Guide | Link |
| ----- | ---- |
| Build an Agent That Knows You | (waiting on the link) |
| Brief Claude Like Your Best Hire | (waiting on the link) |
| 12 Jobs to Hand Your Agents | (waiting on the link) |
| The Monthly AI Reset | (waiting on the link) |
| Five Business Dashboards Hiding in Your Inbox | (waiting on the link) |
| Keep Claude Honest | (waiting on the link) |

---

## 4. Before this gets built

- The six "picked" trigger phrases need your yes.
- `portal/skills.json` is read by no page today. If the cards are built from
  it, it needs the 12 LinkedIn descriptions and the 13 trigger phrases
  filling in, because right now the card text in this draft comes from the
  packs rather than from the portal’s own data.
- The downloads in skills.json are Google Drive folders. The portal’s own
  skill downloads go through the Worker instead, which re-checks the session
  and the week’s release date. Worth deciding which one the cards use.
- Lock down my Claude has no download, so it is not a card. Your note about
  removing its autopilot is already covered.


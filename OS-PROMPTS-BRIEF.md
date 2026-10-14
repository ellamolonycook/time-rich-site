# Brief: /os, add the notetaker prompt at the top + Story Bank prompt (12 Oct)

## Before you start
1. Stay on branch `os-feedback-1`. The uncommitted changes from the last brief stay; this goes into the same PR.
2. Run `git fetch origin` and `git log HEAD..origin/main --oneline -- os/`. If main has new commits touching os/, stop and tell me before changing anything.
3. Don't commit. Leave this file untracked.

## Change 1: Notetaker prompt, top of the page
Add a standalone, always-visible block directly under the hero, above the subscribe band (not inside a dropdown). Same look as the subscribe band's card family (brand palette, Space Grotesk headline, mono eyebrow).

- Eyebrow: START HERE · AI NOTETAKER PROMPT
- Headline: Turn your calls into content.
- Body: Paste this into Claude or ChatGPT with your notetaker connected, or paste in 3 to 5 call transcripts. It decides what to pull from every call: who your client is, the stories you tell and the ideas worth posting.
- Button: Copy the prompt (same copy behaviour and "Copied" state as the existing copy buttons)
- Under the button, a fold labelled "See the prompt" (folded by default, styled like "How to install a skill") showing the full text below in the same prompt box style the Prompts row uses.
- Anchor id: `#notetaker`. Loading /os#notetaker scrolls to the block, flush under the nav.

Prompt text (copy exactly, keep line breaks):

```
You are my content producer. Read my call notes once and pull out three things in the same pass: who my ideal client is, the stories worth telling and the ideas worth posting.

Sources: my AI notetaker calls (Granola or whichever is connected) from the last 90 days. If no notetaker is connected, ask me to paste 3 to 5 transcripts. Keep client, prospect, coaching, workshop and community calls. Skip team syncs, admin, vendor demos and personal notes. Show me the kept and skipped lists and ask "Right calls?" before you start.

Before you start:
Restate my goal in one line, and tell me if it's the right goal.
Don't assume. If you need context the calls can't give, ask me one question at a time.

From each call, capture:
1. Ideal client evidence: who they are, what made them reach out now, every problem they named, what they already tried, their exact words for the problem and the goal, what they only hinted at, their objections, the win that would make them tell a friend, and who wasn't a fit. Cite the call for every line. Label guesses as guesses.
2. Stories: something that happened, with a person, a moment, some tension and an outcome, that I could tell out loud in 60 seconds. Mine, or a client's with names removed.
3. Ideas: a question others would ask too, an opinion against common advice, a framework, a stat or result, or a problem in the client's own words.

A finding from 3+ calls with different people is strong. One call is weak.

Never invent. Every detail must come from my calls. Never include client names, company names or confidential numbers. Write "a founder I work with" instead.

Give me:
My ideal client in one line: [role] at [stage] who [trigger] and is stuck on [problem #1]. Then the full profile, with the top 3 problems in their words.
Then ask me what I want to be known for, the 3 to 5 topics I want to own, and what I will never post about.
Keep only stories and ideas that hit a top-3 problem, the trigger, an objection or the win, and that a thousand creators aren't already posting. Max 5 stories and 10 ideas.
Two tables, stories first: Title (a hook, first person, max 12 words) | Priority (High, Medium, Low) | Date | Why it lands with my client. The ideas table adds a Category column.
The one story to post first, and why.

Put the tables first and skip the intro.

When you finish:
Rate your work out of 10. Say what would make it a 10, then fix it.
Push back on me: where is my ideal client different from what I think?
Tell me what you learned about me that should be saved to my Context page, so you're smarter next time.
```

## Change 2: Story Bank prompt in the Prompts row
- Add a third item to the Prompts row, after "Recurring work audit" and before "Save it once":
  - **Find my stories.** Run it once a month. It reads your calls, voice notes and posts and banks the stories you already tell, ready for stage, posts and sales calls. Button: Copy the prompt
- Change the Prompts row grey line from "Two prompts worth saving." to "Prompts worth saving." (no counts on the page).

Prompt text (copy exactly, keep line breaks):

```
You are my story producer. Find the real stories I already tell and bank them so I can use them again on stage, in posts and on sales calls.

Look through the last 90 days of my material: call transcripts (Granola or my AI note-taker), voice notes, podcast transcripts, LinkedIn posts and newsletters. Tell me in one line which sources you searched and which weren't available.

Before you start:
Restate my goal in one line, and tell me if it's the right goal.
Don't assume. If you need more context, ask me up to 3 questions first.

A story is one specific moment with a before, a turning point and an after. A career summary or an opinion is not a story. Look for moments with a date, place, person or number, lines like "I'll never forget" or "the moment I realised", stories I tell more than once, and moments where a listener reacted.

Never invent. Every detail must come from my material. If something is missing, leave it blank and ask me.

For each story, give me one table row with these columns:
Story Name | The Hook (one line, in my words) | Type | Status | Takeaway | Question it answers | Conflict | Resolution | How I fit in | Times told | Audience evidence | Next place to tell it | Source

Types: Badass (I backed myself and it worked), Party (I love telling it), Tough (not ready: a wound, not a scar), Shit to Shift (something bad forced the breakthrough), Core Story (how I got here).
Status: Banked, Testing, or Needs detail.
If a story is Tough, mark it "Hold" and don't suggest telling it publicly yet.
Leave out anything confidential about clients, deals or other people, and list it under "Held back".

Then give me:
A table of questions people ask me, each with my go-to story and the takeaway I land.
For every "Needs detail" story, the one question you need me to answer.

Put the table first and skip the intro.

When you finish:
Rate your work out of 10. Say what would make it a 10, then fix it.
Push back on me: which stories are weaker than I think, what's missing, what could go wrong if I tell one too early?
Tell me the one story to tell next, and where.
Tell me what you learned about me that should be saved to my Context page, so you're smarter next time.
```

## Keep
Everything from the last brief: row order, all rows folded on load, band buttons, "Free AI resources", skill prompts fold, footer partner line, giveaway band, anchors flush under the nav.

## Test
- Full suite green. Add os-page tests: #notetaker block exists between hero and subscribe band; both new copy buttons copy the exact text above; Prompts row has the Find my stories item and the new grey line.
- localhost:8000/os/ at 375px and 1440px: no horizontal scroll, buttons ≥44px, contrast AA.
- /os#notetaker lands flush under the nav.

## Report
Files changed and test results.

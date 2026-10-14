# Brief: portal launch fixes (13 Oct)

## Before you start
1. `git checkout main && git fetch origin && git pull origin main`
2. `git checkout -b portal-launch-fixes`
3. Don't commit. Leave this file untracked.

Context: your audit of 13 Oct. Week 1 content and the portal redesign are separate work; don't touch them here.

## 1. Remove dev leftovers
- Delete `portal/skills.json` (referenced nowhere; confirm with a grep first).
- Delete `portal/preview.html` (public dev page, linked from nowhere; confirm with a grep first). If anything does reference it, stop and tell me instead.

## 2. "Coming soon" on unbuilt skill packs
In `portal/portal-prompts.js` `card()`: a skill def with no `week` and no database item (today: "Audit my LinkedIn") shows a muted "Download coming soon" label in the same spot and style as "Download unlocks Week N". No button.

## 3. Add the bonus session (10th session)
New migration that inserts the missing session:
- Title: `Bonus: Multi-LLM & Setting Your Harness` (the front end already detects the `Bonus: ` prefix)
- Date/time: Wed 28 Oct 2026, 12:00 to 13:15 America/New_York (16:00 to 17:15 UTC)
- `addevent_url`: `https://www.addevent.com/event/zt2r86vdvnsm`
- `join_url`: do NOT put the Zoom link in the repo. Copy it from an existing session row in the same statement (all sessions share one recurring Zoom link), e.g. `(select join_url from <sessions table> where join_url is not null order by starts_at limit 1)`.
- Make it idempotent (no duplicate if run twice).
- It is session 2 of 10 by date. Check that any numbering, ordering or "next session" logic still shows the right order with 10 rows.

## 4. Ambassador portal access (secure)
Ella's decision: ambassadors who fill timerich.ai/superhuman get portal access. Login is email-only and /superhuman is public, so access must NOT come from the form answer alone, or anyone could pick "Ambassador" and get in.
- Add `ambassador` to the `portal_members.role` CHECK.
- New table `portal_ambassador_allowlist (email text primary key, name text, added_at timestamptz default now())`, emails stored lowercase, RLS on, no public access.
- In `handleSuperhumanQuestionnaire`: keep the Notion write exactly as is. Additionally, if role is "Ambassador" AND the lowercased email is on the allowlist, call `upsertPortalMember` with role `ambassador`. Otherwise do nothing extra (no error shown to the user).
- Add a SQL helper `add_ambassador(email, name)` that inserts into the allowlist and upserts the `portal_members` row (role `ambassador`), so an ambassador added after filling the form also gets in. Document it next to the existing how-to comment in `portal_schema.sql`.
- Ambassadors see exactly what buyers see. Keep them out of the member directory, as now.
- Never downgrade an existing buyer/second_seat/team row to ambassador.

## 5. Data check I'll run in Supabase
Don't change data for this one. Give me a read-only SQL query that lists every session with title, start time, whether `join_url` matches the most common `join_url`, and whether `addevent_url` is set.

## Test
- Full suite green. Add tests for: coming-soon label; the bonus migration (title prefix, 10 sessions, idempotent, no Zoom URL anywhere in the repo); ambassador path (allowlisted ambassador gets a member row, non-allowlisted ambassador doesn't, existing buyer isn't downgraded).
- `grep -r "zoom.us" .` returns nothing new in the diff.

## Report
Files changed, migrations to run (in order), the SQL query from item 5, and test results.

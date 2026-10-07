# Tests — /sh-apply application form, worker mapping, Time Rich Members

Three suites, no framework. Plain Node, one file each, run in a couple of seconds.

```bash
cd scripts/tests
npm install     # once — pulls jsdom
npm test        # all three suites
```

Or one at a time: `npm run test:worker` / `npm run test:form` / `npm run test:members`.

Exit code is non-zero if anything fails, so this drops into CI as-is.

The two jsdom suites need Node 22.12 or newer (jsdom loads an ES module with
`require()`). On an older Node 22 run them as
`node --experimental-require-module form.test.mjs`.

## `worker.test.mjs`

Imports [`worker/src/index.js`](../../worker/src/index.js) directly and stubs
`globalThis.fetch`, so it asserts on **the exact JSON we would send to Notion**
without touching the network or the real database.

Covers the `/superhuman` precise mapping: every `Department`, `Track preference`
and `1:1 coaching` option round-trips to its exact Notion option name; an
unrecognised select value is dropped rather than silently creating a new option;
phone must be E.164 or it isn't written; scheme-less links are normalised; empty
`url`/`phone_number` columns are omitted (Notion rejects `""`); text is clipped
at 2000 chars; `Status` is stamped `New`; and `Call time`, `Video watched` and
the old form's columns are never written.

It also covers `POST /cal-webhook`, the Cal.com booking webhook. The suite signs
each body the way Cal does — HMAC-SHA256 over the *raw* bytes, hex, in
`x-cal-signature-256` — so it exercises the real verification path: the wrong
secret, a missing or malformed header, and a body tampered with after signing
are all `401` with nothing written; an uppercase hex signature still verifies.
Past that it asserts the Notion `PATCH` and the Slack post for each trigger:
`BOOKING_CREATED` sets `Status` → `Call booked` and `Call time`, and posts the
full breakdown pulled off the matched Notion row in both New York and Lisbon
time; a booking from an email with no application posts Slack only, marked
`⚠️ no application found for this email`; `BOOKING_RESCHEDULED` moves `Call time`
and leaves `Status` alone; `BOOKING_CANCELLED` puts `Status` back to `New` and
clears the slot; anything else is a bare `200`.

The rule that suite exists to pin: **the handler always answers `200` once the
signature checks out.** Cal retries every non-2xx, and a retry would mean a
duplicate Slack post — so Notion being down still gets the Slack post out, Slack
being down still leaves the Notion update in place, and neither shows up as an
error to Cal. The work runs in `ctx.waitUntil()`, so the tests pass a `ctx` and
await what it collects, exactly as the Workers runtime does after the response
has already gone back.

It also pins the behaviour of the routes this change did *not* touch —
`/waitlist`, `/coaching`, `/qualify`, `/accelerator`, the legacy `/superhuman`
payload, and CORS — so a future edit to the worker can't quietly break them.

Time Rich Members has its own block, with one fake standing in for Notion,
Supabase REST and Storage, Google Drive and Slack. Notion's replies use the real
response shape, and a `PATCH` reply carries what is already stored on the row,
so the suite can prove a profile is built from **Notion's stored properties, not
the request body**. It covers:

- **Sync:** only active `buyer` and `second_seat` members are listed (team,
  ambassadors, inactive and unknown emails are skipped); a Supabase outage never
  changes the form's response or logs an answer.
- **Photos:** success, Drive's HTML sign-in page, oversize (declared and found
  while reading), bad links and every link shape; Slack is told once and the
  link is never logged. The re-download rule on `photo_source_url`: unchanged
  and `ok` keeps the photo, a new link or a `failed`/`missing` status tries again.
- **Backfill** (`/portal-directory-sync`): secret required, identical 403s,
  every page of the database read, safe to run twice.
- **Read endpoint** (`/portal-directory`): 403 for buyers until
  `directory_enabled` is a JSON `true`, 200 for team; sorted profiles, signed
  photo URLs, no `email` or `photo_source_url`, https links only, byte-identical
  403s for every refusal, and CORS for timerich.ai only.

## `form.test.mjs`

Loads [`sh-apply/index.html`](../../sh-apply/index.html) into jsdom and actually
drives it: clicks, typing, `Enter`, `Cmd+Enter`, browser back.

Covers the one-question-at-a-time behaviour (single visible screen, `N of 9`
progress, validate-on-advance only, auto-advancing selects, the conditional Q9b
sub-step, back preserving answers, sessionStorage persisting then clearing on
submit), the single POST and its exact payload shape, and the thank-you page's
`VIDEO_ENABLED` / `PODCAST_ENABLED` states.

It also covers the question transitions, which have a rule worth stating: during
a transition **two** questions are in the DOM — the outgoing one is taken out of
flow and laid over the incoming one so the motions can overlap. So the suite
distinguishes `visible()` (the question in flow) from `inDom()` (everything not
`hidden`), and asserts the end state is always exactly one question, including
when an advance interrupts a transition already in flight. Direction is asserted
both ways, `prefers-reduced-motion` is exercised by stubbing `matchMedia` before
the page script runs, and focus is checked to land *after* the incoming question
arrives rather than mid-flight.

Note that the in-page Back button goes through `history.back()`, so its effects
land on a later task — assertions about a Back need a `sleep` first, exactly as
they would in a real browser.

Two things it deliberately can't cover, because jsdom has no CDN and no layout:

- **intl-tel-input.** The phone question falls back to a strict `+E.164` regex
  when the library is absent, and that fallback is what the suite exercises. The
  library path — country dropdown, IP auto-detect, `isValidNumber()` — needs a
  real browser.
- **Anything visual.** Transitions, tap-target sizes, and whether the question
  clears the mobile keyboard are all eyeball checks.

## `members.test.mjs`

Loads [`portal/members.html`](../../portal/members.html) into jsdom with a fake
Worker and uses it the way a member would.

- **Grid:** one card per profile in the Worker's order; name, hook line, then
  title and company; initials on sage when there is no photo, the URL is not
  https, or the image fails to load; typed markup stays text.
- **Search:** name, company and superpower only, case-insensitive, with a
  no-match line.
- **Pop-up:** fields in the brief's order, LinkedIn as the primary button and
  the rest as icon links, no form; focus moves in, Tab is trapped, Esc, the close
  button or a click outside closes it and focus returns to the card.
- **States:** 403 shows "opens soon", an empty list shows the brief's empty
  state, a server error asks for a refresh.
- **Menu link:** the other portal pages are loaded with the real
  `portal-access.js`; their hidden Members link appears only on a 200 from the
  directory, a definite answer is cached for ten minutes, and sign out clears it.

Like the form suite it has no layout, so the grid sizes and the pop-up's look
are eyeball checks.

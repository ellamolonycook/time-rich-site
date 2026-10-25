# Tests — /sh-apply application form, worker mapping, Time Rich Members, portal members

Sixteen suites, no framework. Plain Node, one file each, run in a couple of seconds.

```bash
cd scripts/tests
npm install     # once — pulls jsdom and PGlite
npm test        # every suite
```

Or one at a time: `npm run test:worker` / `npm run test:form` / `npm run test:members` /
`npm run test:portal`.

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

`POST /os-email` — the route behind the email gate on /os — has its own block,
with a fake standing in for Resend. What it pins is the shape of the one call we
make (the Contacts API, `unsubscribed: false`, the address lowercased, the
audience endpoint only when `RESEND_OS_AUDIENCE_ID` is set) and, more
importantly, the two things that must never happen: **we never send the visitor
an email**, and **an address we already hold is a success, not an error** — a
`409`, or any status whose body says it already exists, answers `ok: true`. Every
malformed address is refused `400` before Resend is touched, a genuine Resend
failure is a logged `502`, and the CORS and origin rules are the other form
routes'.

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

## `onboarding-emails.test.mjs`

The two automatic emails a new Superhuman Accelerator member gets: the welcome
straight away and the prep email two hours later. Both are handed to Resend in
the same request — the prep one carries `scheduled_at` rather than waiting on a
cron — so the suite asserts on the pair of POSTs the Worker would make to
`https://api.resend.com/emails`, without touching the network.

One fake stands in for Supabase, Notion and Resend. Supabase answers in the real
`portal_upsert_member` shape, `{"ok":true,"id":...,"created":...}`, because
`created` is the whole gate.

- **Who gets them**: a live paid ThriveCart order from somebody new, and a +1
  added through `/onboard`. A buyer is told about their +1; the +1 is told they
  are one, and gets that line *instead of* the buyer's.
- **Who does not**: an existing member (`created: false`), a refund, a test-mode
  order, an order with no `mode`, a bad webhook secret, a buyer who has not
  named their +1, and a buyer who names themselves. A $0 coupon order *does*
  count.
- **The kill switch**: `ONBOARDING_EMAILS_ENABLED` has to be exactly `"true"` —
  `"TRUE"`, `"false"`, `"1"` and unset all send nothing.
- **Timing**: the welcome has no `scheduled_at`, the prep is scheduled exactly
  two hours out as an ISO 8601 instant, and the idempotency keys are
  `onboarding-welcome/<member id>` and `onboarding-prep/<member id>`.
- **The copy at kickoff** (Mon 26 Oct 2026, 16:00 UTC): "we kick off" vs "we
  kicked off", "See you Monday!" vs "See you at the next session!", and the
  WhatsApp step's Saturday sentence. Each email is built against *its own* send
  time, so an order an hour before kickoff gets a pre-kickoff welcome and a
  post-kickoff prep.
- **Links**: every `href` is one of the eleven Ella gave us, no raw URL appears
  in what the member reads, no link has empty text, and every link survives into
  the plain-text alternative.
- **Failure is quiet**: no Resend key, no sender, or a Resend 500 all still
  return 200 to ThriveCart and the onboarding form, and nothing this feature
  logs carries an email address. A name with markup in it is escaped, and an
  order with no name falls back to "Hi there,".

## `onboard-page.test.mjs`

Loads [`onboard/index.html`](../../onboard/index.html) into jsdom and drives the
plus-one form the way a buyer does, with the worker's lookup JSON stubbed.

The rule it exists for is the one a real buyer fell through: a buyer who chose
**"Decide later"** has a saved choice, so the order comes back `isCompleted`,
but their plus one is still missing. The page used to send them to the completed
screen, which said to come back any time before kickoff and then gave them no
form to do it in. So a `Not Sure yet` lookup now lands on the form, on "Add
them now", with the name and email fields open, whether they arrived on a link
or typed their email into the lookup box.

Past that: a buyer who already named a plus one still goes straight to the
completed screen and nothing is posted; "Decide later" is still a real answer
and still confirms with the plus one left open; the second submit posts
`choice: "named"` against the same order and lands on "Your seat and plus one
are saved."; and an order we cannot verify, or a save that fails, leaves the
buyer with the error said and a button they can press again.

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

## `portal-member.test.mjs`

Runs [`supabase/portal_schema.sql`](../../supabase/portal_schema.sql) and the
`portal_upsert_member` migration in [PGlite](https://pglite.dev) (Postgres
compiled to WASM, in-process, no server), then calls the real function and
asserts on the rows it leaves.

Covers the role rules: a `team` row is never changed, whatever role comes in
(role and `order_id` both kept); a `second_seat` upsert never downgrades a
`buyer`; a `buyer` upsert upgrades a `second_seat`; emails are normalised; the
passcode is never touched; and an inactive member is never switched back on.
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

## `os-gate.test.mjs`

Loads [`os/index.html`](../../os/index.html) into jsdom and drives the email
gate the way a visitor would, with a fake standing in for the Worker.

The gate exists to collect an email before the page opens, so the rules worth
pinning are mostly about what happens when that goes wrong. In order of what
they would cost us:

- **A visitor is never stuck behind it.** A `502`, a thrown request and a
  request that never comes back all remove the overlay anyway, log the reason to
  the console, and store the unlock so there is no second wall. The five-second
  timer is trapped in `beforeParse` and fired by hand, so the suite does not sit
  there waiting for it.
- **The page is covered, never removed.** Every row id, `#main`, the footer, the
  canonical link, the OG tags and both existing tracking scripts are still in
  the document while the overlay is up, and still there after it goes.
- **Without JavaScript there is no gate.** The overlay carries `hidden` in the
  markup itself and only the inline script raises it, so a script that never ran
  leaves the page readable. That is also why the script defers `inert` to
  `DOMContentLoaded`: it runs *above* the markup it covers, which does not exist
  yet.
- **A returning visitor skips it** on either stored value, and storage that
  throws on every touch (private Safari, blocked site data) changes nothing.

Past that: the brief's copy word for word, a malformed address refused with no
request sent and the button left usable, the exact `{ email, first_name, source }`
body, the one `os_email_submit` event, and the page's own rows and mobile menu
still working once the gate has gone — including that the menu inerts the *nav*
wordmark rather than the gate's, which is the trap of putting a second wordmark
above it in the document.

No layout here either, so the 375px and 1440px views, the 44px targets and
whether the mobile keyboard clears the button are eyeball checks.

## `portal-footer.test.mjs`

Reads the footer out of the six portal pages inside the gate. The line is
"© 2026 Time Rich · Privacy · Terms · WhatsApp community · Need help?
emc@timerich.ai", in a wrapping flex row.

The thing worth pinning is the separators. On a narrow screen the line breaks
over two, and the "·" after the last item on line one is carried down to the
head of line two, which reads as "· Need help? …". CSS cannot ask whether an
element starts a wrapped line, so the rule takes the whole set out below the
width at which the line fits in one row and opens the gap up instead. Measured
in a browser: with every item showing, the footer is a single row from 540px;
the breakpoint is 576px, which leaves room for a font metric or an extra word.

So the suite checks the shape that rule depends on — four separators per page,
every one of them a `.trp-foot-sep` and no strays, the conditional WhatsApp dot
still paired with its link under `[hidden]`, the stylesheet hiding the class by
default and restoring it above a breakpoint that is at least 540px, and the
built CSS carrying both halves. It also checks no sponsor lockup is left under
the line.

jsdom does no layout, so the wrap itself is not measured here. If a word is
ever added to this line, check it in a browser at 540px as well.

## `stanley-logo.test.mjs`

Reads the "Powered by Stanley" lockup out of
[`accelerator/index.html`](../../accelerator/index.html) and the seven portal
pages in jsdom, and checks the two PNGs by their headers.

Stanley is the anchor sponsor, so what this pins is that the credit is actually
on every page that owes them one and is a working one: the referral link on
every lockup, `target="_blank"` with `rel="noopener sponsored"`, `alt="Stanley"`
so the credit survives with images off, and `width`/`height` matching the file's
own 765×203 so the logo cannot shove the page about while it loads. It also
pins where each lockup sits — hero and closing band on /accelerator, under the
card on the sign-in page, and exactly one in the header on each of the pages
inside — and that the style is written once per site rather than once per
placement.

The pages inside used to carry two: one in every footer, and a second beside
the wordmark from 1280px up, so a desktop member met the same logo twice on one
screen. The footer copy is gone. With only one left it can no longer be held
back to a desktop width, so the suite checks the header lockup is shown at
every width and that what gives way on a phone is the wording, which the
stylesheet clips rather than removes — a credit set to `display: none` would
not be read out either.

Two image files, not one: the wordmark is black and disappears on the portal's
dark theme, so the portal carries a reversed copy beside the normal one and the
theme picks between them. The suite checks both are present on every themed page
and that the original `stanley/stanley-logo.png` is left as it was — 765×227,
no alpha — since that is what the transparent copies are cut from.

No layout here either, so clearance in the header, the knockout's edges and
whether the lockup reads as muted are eyeball checks.

## `portal-welcome-video.test.mjs`

Drives [`club/curriculum.html`](../../club/curriculum.html) in jsdom with the
real `portal-live.js` and the real `portal-access.js`, and hands it a Start
here week carrying Ella's welcome video and the calendar row.

Both used to sit in the welcome box — the video as a small side card with an
Open button that sent the member out to YouTube, the calendar as a second
card beside the letter. The welcome box now holds only Ella's letter and the
Time Rich Pep Talk, and the two of them have a band of their own directly
under it: the video wide on the left, a stripped-back calendar card on the
right, stacked on a phone.

What the suite pins is the part that is easy to get wrong by hand. The `src`
is rebuilt by the portal's own `embedSrc` from a pattern-checked id, so the
stored URL never reaches an `iframe` — `http:`, `javascript:`, an unknown
host and an id of the wrong shape are all refused, and the raw URL appears
nowhere on the page. Past that: the band is a section of its own, after the
welcome box, and the welcome holds neither a player, nor a card, nor a link
of any kind; the iframe is `loading="lazy"` and carries the row's title,
which is also the heading above it; the heading and the player are all the
video column holds, so the row's "3 minutes." is not drawn; and the calendar
card is its title and its button and nothing else, even though the row has a
body line.

Nothing sends the member off the page to watch. A video URL `embedSrc`
refuses draws **nothing** — no player, no button, no link, not even its
title — and a second embeddable video is dropped rather than linked out. The
suite checks every `a[href]` in the live container, not just the band, so a
stray link cannot hide in a corner it does not look at.

The kind and the sort still decide: an embeddable URL on a `link` row is one
of the band's cards, and a video at sort 150 is a setup step in Week 1's
panel instead. With neither a video nor a card, the band is not drawn at all.

It also checks the two things this was not allowed to disturb — the letter
and the Pep Talk — and that the loading placeholder carries the band, since
the player is the tallest thing above the week tabs and the footer would
otherwise jump when the payload lands.

The video carries no tick. A cross-origin iframe never tells the page that
play was pressed, and a tick redraws the page, which would restart a video
the member had just started.

jsdom does no layout, so the 16:9 box, the rounded corners, the video-beside
-card / video-above-card switch at 760px and the absence of sideways
scrolling at 320–1440px are eyeball checks.

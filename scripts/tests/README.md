# Tests — /sh-apply application form + worker Notion mapping

Two suites, no framework. Plain Node, one file each, run in a couple of seconds.

```bash
cd scripts/tests
npm install     # once — pulls jsdom
npm test        # both suites
```

Or one at a time: `npm run test:worker` / `npm run test:form`.

Exit code is non-zero if anything fails, so this drops into CI as-is.

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

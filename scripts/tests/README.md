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

It also pins the behaviour of the routes this change did *not* touch —
`/waitlist`, `/coaching`, `/accelerator`, the legacy `/superhuman` payload, and
CORS — so a future edit to the worker can't quietly break them.

## `form.test.mjs`

Loads [`sh-apply/index.html`](../../sh-apply/index.html) into jsdom and actually
drives it: clicks, typing, `Enter`, `Cmd+Enter`, browser back.

Covers the one-question-at-a-time behaviour (single visible screen, `N of 9`
progress, validate-on-advance only, auto-advancing selects, the conditional Q9b
sub-step, back preserving answers, sessionStorage persisting then clearing on
submit), the single POST and its exact payload shape, and the thank-you page's
`VIDEO_ENABLED` / `PODCAST_ENABLED` states.

Two things it deliberately can't cover, because jsdom has no CDN and no layout:

- **intl-tel-input.** The phone question falls back to a strict `+E.164` regex
  when the library is absent, and that fallback is what the suite exercises. The
  library path — country dropdown, IP auto-detect, `isValidNumber()` — needs a
  real browser.
- **Anything visual.** Transitions, tap-target sizes, and whether the question
  clears the mobile keyboard are all eyeball checks.

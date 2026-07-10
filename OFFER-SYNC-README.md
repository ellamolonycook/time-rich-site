# Offer Sync Engine

Change the offer in **one** place and the T&Cs, privacy page, sales pages, and the
reviewed coaching contract update themselves. They can never silently drift.

## The one rule

`offer.json` is the single source of truth. Prices, dates, entity, tiers, spots,
access length, refund window, processors, jurisdiction all live there and nowhere
else. If a number needs to change, change it in `offer.json` and re-run the sync.

## The everyday flow

1. **Edit** `TR Landing Page/offer.json`.
2. **Sync** the pages:
   ```sh
   node "TR Landing Page/sync-offer.mjs"
   ```
3. **Commit** the offer.json change plus the files it updated.

That's it. The pages now carry the new values.

## The marker convention

Every offer-derived value in an HTML or Markdown file is wrapped in a marker:

```html
<!--OFFER:key-->rendered value<!--/OFFER:key-->
```

- `key` is a **dot-path into `offer.json`**.
- The text **between** the two comments is what the sync engine rewrites. Everything
  outside the markers (your surrounding copy, layout, styling) is never touched.
- The opening and closing `key` must match.

Examples:

| Marker | Renders |
|---|---|
| `<!--OFFER:entity-->Growth Haus LLC<!--/OFFER:entity-->` | the legal entity |
| `<!--OFFER:jurisdiction-->Wyoming, US<!--/OFFER:jurisdiction-->` | governing-law state |
| `<!--OFFER:doorsClose-->2026-09-01<!--/OFFER:doorsClose-->` | doors-close date |
| `<!--OFFER:accessMonths-->6<!--/OFFER:accessMonths-->` | months of access |
| `<!--OFFER:tiers.0.name-->The Content OS<!--/OFFER:tiers.0.name-->` | tier 1 name |
| `<!--OFFER:tiers.0.price-->$197<!--/OFFER:tiers.0.price-->` | tier 1 price |
| `<!--OFFER:coaching.sixWeek.price-->$4,950<!--/OFFER:coaching.sixWeek.price-->` | 6-week price |
| `<!--OFFER:coaching.sixWeek.spots-->4<!--/OFFER:coaching.sixWeek.spots-->` | spots |

Values that contain `$` and commas (like `$4,950`) are inserted **literally** and
safely. Array indices (`tiers.0.price`) and nested paths
(`coaching.twelveWeek.price`) both work. A marker can span multiple lines; the sync
collapses it to the exact value.

To add a new synced value: put the fact in `offer.json`, then wrap it in the page with
a marker whose `key` is its dot-path. Re-run the sync and it fills in.

## Files the engine maintains

Configured in the `FILES` list at the top of `sync-offer.mjs`:

- `challenge/terms.html`
- `challenge/privacy.html`
- `home/index.html`
- `coaching/index.html`
- `contentmachine/index.html`
- `../Time Rich/01 Program & Offer/1-1 AI System Coaching/18b — Coaching Terms & Agreement (REVIEWED DRAFT).md`

A file with no markers is left alone. A missing file is skipped with a warning.

## Drift check (proves pages match the offer)

```sh
node "TR Landing Page/sync-offer.mjs" --check
```

Dry run. Prints any file that would change and **exits non-zero** if anything is
stale. Exit `0` means every page matches `offer.json`. Use this in the ship phase and
in the hand-off report to prove there's no drift.

## The git guard (opt-in)

A pre-commit hook runs the drift check and blocks a commit that would leave pages
stale. It is **not** force-enabled. Turn it on once, per clone:

```sh
git config core.hooksPath "TR Landing Page/.githooks"
```

After that, any commit runs `sync-offer.mjs --check` first. If a page is stale the
commit is blocked and it tells you to run `node "TR Landing Page/sync-offer.mjs"`.
To bypass in a pinch: `git commit --no-verify`.

## Why this matters

The T&Cs and privacy page are now **self-maintaining**. Change a price, a date, the
refund window, or the entity in `offer.json`, sync, and the legal pages update in
lockstep with the sales pages. No more legal terms quoting last month's price.

## Open items

`offer.json` carries a `_todo` array for any value that still needs Ella's
confirmation (currently: the real refund window, the tier-price and doors-close
drift on the live `/contentmachine`, the Stripe checkout links, and the final
coaching tier names). Confirm each, update `offer.json`, and re-sync.

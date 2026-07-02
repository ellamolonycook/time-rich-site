# Time Rich — Resources pipeline

Turns the Substack into on-brand resource pages on timerich.ai. Run it weekly.

## What gets built
- `resources/<slug>.html` — a full, Substack-style article page per post (with a
  `canonical` tag back to Substack so Google doesn't penalise duplicate content).
- `Images/resources/<slug>.jpg` — the post's cover image, auto-compressed.
- `resources.html` — the resource **hub** (filterable grid of every resource).
- `resources-manifest.json` — the data the hub + the homepage grid render from.

The homepage "Free Resources" section renders its cards from the manifest too, so
it stays in sync automatically.

## The weekly process (2 minutes)

```bash
cd "TR Landing Page"

# 1. Preview what's new (writes nothing)
node scripts/sync-resources.mjs --dry

# 2. Pull new posts → generate pages, covers, hub, manifest
node scripts/sync-resources.mjs

# 3. (Optional) tidy: open resources-manifest.json and fix any auto-assigned
#    category, or improve a dek. Re-run step 2 if you change source posts.

# 4. Ship it
git add resources resources.html resources-manifest.json Images/resources
git commit -m "Resources: sync latest Substack posts"
git push
```

GitHub Pages redeploys automatically. Done.

The script is **idempotent** — it only adds posts that aren't already published, so
running it repeatedly is safe.

## Which Substack it reads

Defaults to `iiculture.substack.com` (where the posts currently live). To point it
somewhere else without editing code:

```bash
SUBSTACK_FEED="https://timerichai.substack.com/feed" node scripts/sync-resources.mjs
```

Once the @timerichai ("Time Rich") publication has published posts, change the
default `FEED_URL` at the top of `sync-resources.mjs` and re-run.

## Making it run itself (optional)

- **Hands-on:** run the 4 commands above every Monday.
- **Scheduled agent:** ask Claude Code to run this on a schedule (the `/schedule`
  skill creates a weekly cron routine that runs the sync + commits + pushes).
- **CI:** a GitHub Action on a weekly `cron:` that runs `node scripts/sync-resources.mjs`
  and commits the result. (No API key needed — full post content comes straight
  from the RSS feed.)

## Editing how pages look / read

Everything is in `scripts/sync-resources.mjs`:
- `articlePage()` — the article template + styling.
- `hubPage()` — the hub grid template.
- `CATEGORIES` — the filter buckets + the keywords used to auto-classify posts.
- `sanitizeBody()` — what gets stripped from Substack's HTML (subscribe widgets etc.).

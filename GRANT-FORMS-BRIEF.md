# Brief: save grant applications to Notion + notify Slack (13 Oct)

## Before you start
1. `git checkout main && git fetch origin && git pull origin main`
2. `git checkout -b grant-forms-wiring`
3. Don't commit. Leave this file untracked.

Context: `ffg/index.html` and `stanley/index.html` collect applications but don't save them (`// No network submit yet.`). Angel may be redesigning the Stanley page, so this brief only touches `ffg/index.html` on the front end. Stanley gets its worker route now and its front-end wiring later.

## 1. Worker: two new routes, `POST /ffg` and `POST /stanley`
Follow the existing form handlers in the worker (e.g. the questionnaire and application routes): same CORS rules, same rate-limit pattern, same Notion helper style.

- New var in `wrangler.toml` `[vars]`: `NOTION_GRANTS_DATABASE_ID = "8b8d014a-a83f-4ec6-b557-68cfbbf0e935"`
- New secret (I'll set it): `SLACK_GRANTS_CHANNEL_ID`. Post with the existing `SLACK_BOT_TOKEN` via `chat.postMessage`.
- Honeypot: if `_gotcha` is non-empty, return the normal success response and save nothing.
- Validate: `full_name` and a valid `email` required, else 400. Trim everything. Cap each text field so Notion's 2000-char rich-text limit can't fail the write.
- Arrays (`entry_steps`, `platforms`) are saved as a comma-separated string.

Notion property mapping (database "Grant Applications"):

| Property | Type | Value |
|---|---|---|
| Name | title | full_name |
| Grant | select | `/ffg` → "Female Founder", `/stanley` → "Founders Building in Public" |
| Status | select | "New" |
| Email | email | email |
| LinkedIn | url | linkedin (omit if empty or not a URL) |
| Company, Stage, Revenue, Why, Show up, Entry steps, Source, Form version | rich text | matching fields |
| Woman founder, Lisbon | rich text | ffg only |
| Platforms, Posts, Followers, Share Stanley | rich text | stanley only |

`Submitted` is created_time; don't set it.

Slack message after a successful Notion write, short:
`New grant application · <Grant>` then lines for name, company, stage, revenue, LinkedIn, and a link to the Notion page (use the `url` from the Notion response).

Failure rules:
- Notion write fails → return 500 so the form shows an error. Log it.
- Slack post fails → still return success to the applicant (the row is saved). Log it.

## 2. Front end: `ffg/index.html` only
- Set `FORM_ENDPOINT` to `https://time-rich-forms.timerich.workers.dev/ffg` and replace the "No network submit yet" block with a real `fetch` POST of the existing payload (JSON).
- Disable the submit button while sending.
- Only redirect to the thanks page on a 2xx response. On failure, keep the form filled in and show a short inline error: "Something went wrong. Please try again, or email ella@timerich.ai." Check the existing contact email used elsewhere on the site and use that one instead if it differs.
- Don't touch `stanley/index.html`.

## Test
- Full suite green. Add worker tests for both routes:
  - valid ffg and stanley payloads → Notion called with the right Grant select and properties, Slack called
  - honeypot filled → 200, no Notion, no Slack
  - missing email → 400
  - Notion error → 500
  - Slack error → still 200
  - long `why` text is capped
- Front-end test for ffg: success redirects, failure shows the error and doesn't redirect.

## Report
Files changed, the new var and secret names, and test results.

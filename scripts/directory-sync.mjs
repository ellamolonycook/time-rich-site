#!/usr/bin/env node
/* Runs the member directory backfill to the end.
 *
 * POST /portal-directory-sync does one batch per call, because a Worker on
 * Cloudflare's free plan gets about 50 outside calls per invocation and one
 * questionnaire row costs roughly five of them. Asked to do all of them it
 * died partway through, and the rows at the tail of the list never synced.
 * So the endpoint takes a cursor and hands the next one back, and this script
 * is the loop that keeps calling it until there is no next one.
 *
 * Usage:
 *
 *   DIRECTORY_SYNC_SECRET=... node scripts/directory-sync.mjs
 *
 * Options, all optional:
 *
 *   --url=<endpoint>   the Worker route. Defaults to the production one.
 *   --limit=<n>        rows per call. Defaults to the Worker's own default (8).
 *                      Raise it only if the Worker is on a paid plan; past
 *                      about ten the subrequest ceiling is back.
 *   --cursor=<cursor>  start partway through, with a next_cursor from an
 *                      earlier run. Use this to resume after an interruption.
 *
 * The secret is read from DIRECTORY_SYNC_SECRET and is never printed. It is
 * the same value as the Worker's `wrangler secret put DIRECTORY_SYNC_SECRET`.
 *
 * Safe to run any number of times: each row ends in the same state, and an
 * uploaded photo (Photo Link = "Uploaded") is kept rather than re-fetched.
 *
 * Exits 0 when every row was processed, 1 on a failure or a partial run.
 */

const DEFAULT_URL = 'https://time-rich-forms.timerich.workers.dev/portal-directory-sync';

// How long to wait between batches. The Worker is doing real work for each
// one and Notion rate limits at about three requests a second; this is
// politeness, not correctness.
const PAUSE_MS = 400;

function arg(name) {
  const prefix = '--' + name + '=';
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const secret = (process.env.DIRECTORY_SYNC_SECRET || '').trim();
if (!secret) {
  console.error('DIRECTORY_SYNC_SECRET is not set. Export it and run again.');
  process.exit(1);
}

const endpoint = arg('url') || DEFAULT_URL;
const limit = arg('limit');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const totals = { processed: 0, listed: 0, skipped: 0, failed: 0, photo_failed: 0 };

let cursor = arg('cursor') || null;
let batch = 0;

for (;;) {
  const url = new URL(endpoint);
  if (cursor) url.searchParams.set('cursor', cursor);
  if (limit) url.searchParams.set('limit', limit);

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + secret } });
  } catch (err) {
    console.error('\nThe request failed: ' + (err && err.message));
    break;
  }

  let body = null;
  try { body = await res.json(); } catch { /* reported below */ }

  if (res.status === 403) {
    console.error('\nRefused (403). Check DIRECTORY_SYNC_SECRET matches the Worker secret.');
    process.exit(1);
  }
  if (!res.ok || !body || body.ok !== true) {
    console.error('\nBatch ' + (batch + 1) + ' failed with ' + res.status +
      (body && body.error ? ': ' + body.error : ''));
    // The cursor it was given is still good, so say so: the run can pick up
    // from exactly here rather than starting over.
    if (cursor) console.error('Resume with --cursor=' + cursor);
    break;
  }

  batch++;
  for (const key of Object.keys(totals)) totals[key] += Number(body[key] || 0);

  console.log('batch ' + batch + ': ' +
    body.processed + ' processed, ' + body.listed + ' listed, ' +
    body.skipped + ' skipped, ' + body.failed + ' failed' +
    (body.photo_failed ? ', ' + body.photo_failed + ' photo failures' : ''));

  cursor = body.next_cursor || null;
  if (!cursor) break;

  // A batch that came back empty but still has a cursor would loop forever
  // otherwise. Notion does not do this, but a guard costs nothing.
  if (body.processed === 0) {
    console.error('\nA batch processed nothing but asked to continue. Stopping.');
    break;
  }

  await sleep(PAUSE_MS);
}

const done = cursor === null;
console.log('\n' + (done ? 'Done' : 'Stopped early') + ' after ' + batch + ' batch(es).');
console.log('  processed     ' + totals.processed);
console.log('  listed        ' + totals.listed);
console.log('  skipped       ' + totals.skipped);
console.log('  failed        ' + totals.failed);
console.log('  photo failed  ' + totals.photo_failed);
if (!done) console.log('\nResume with --cursor=' + cursor);

process.exit(done && totals.failed === 0 ? 0 : 1);

// The Prompt Library's skill rows, run for real in PGlite: the schema, the
// migrations that touch portal_items, then the one that wires the 14 uploaded
// packs. Asserts the rows land, that running it twice changes nothing, and
// that every card on the Prompt Library page has a row to match it.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

const sql = (path) => readFileSync(new URL('../../supabase/' + path, import.meta.url), 'utf8');
const SKILLS_MIGRATION = 'migrations/20261012090000_portal_prompt_library_skills.sql';

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(sql('portal_schema.sql'));
// No service_role here, on purpose: this is plain Postgres, and the migration
// below has to cope with that the way the directory migration does.
await db.exec(sql('migrations/20261007120000_portal_items_allow_skill_kind.sql'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const skills = async () =>
  (await db.query(
    "select week_id, sort, title, body, url, published from public.portal_items where kind = 'skill' order by sort, id"
  )).rows;

// The one pack that was already wired before this migration, plus a link and
// a note, so the new rows have to sort after real neighbours.
await db.exec(`
  insert into public.portal_items (week_id, kind, title, body, url, sort, published) values
    (0, 'skill', 'Business COMPASS', 'Builds your Business COMPASS.', 'compass-superhuman.zip', 3, true),
    (0, 'link',  'Workbook', null, 'https://example.com', 4, true),
    (0, 'text',  'How to install a skill', 'Seven short steps.', null, 5, true);
`);

console.log('\nPrompt Library skills — the migration');
{
  await db.exec(sql(SKILLS_MIGRATION));
  const rows = await skills();

  check('fifteen skill rows: the one that was there, plus fourteen',
    rows.length === 15, rows.length);
  const byFile = Object.fromEntries(rows.map((r) => [r.url, r]));
  check('the security pack lands in week 0, where it is needed on day one',
    byFile['security-superhuman.zip'].week_id === 0, byFile['security-superhuman.zip']);
  check('the story bank and the twelve LinkedIn packs land in week 3',
    rows.filter((r) => !['compass-superhuman.zip', 'security-superhuman.zip'].includes(r.url))
      .every((r) => r.week_id === 3) &&
    rows.filter((r) => r.week_id === 3).length === 13,
    rows.filter((r) => r.week_id === 3).length);
  check('every new row is published, or a member would never see it',
    rows.every((r) => r.published === true));
  check('every row carries a bare file name, never a URL',
    rows.every((r) => /^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/.test(r.url)),
    rows.filter((r) => !/^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/.test(r.url)).map((r) => r.url));
  check('the pack with nothing uploaded is left out',
    !rows.some((r) => r.url === 'audit-linkedin-for-icp-goal.zip'),
    rows.map((r) => r.url));
  check('every row has a title and a line of its own',
    rows.every((r) => r.title && r.title.trim() && r.body && r.body.trim()));
  check('the week 0 row sorts after the items that were already there',
    byFile['security-superhuman.zip'].sort > 5, byFile['security-superhuman.zip'].sort);
  check('week 3 was empty, so its rows start at 1',
    Math.min(...rows.filter((r) => r.week_id === 3).map((r) => r.sort)) === 1,
    rows.filter((r) => r.week_id === 3).map((r) => r.sort));
  // sort only has to be unique inside a week, which is how portal_get orders
  check('no two skills in the same week share a sort position',
    rows.every((r, _, all) =>
      all.filter((o) => o.week_id === r.week_id && o.sort === r.sort).length === 1),
    rows.map((r) => [r.week_id, r.sort, r.url]));
  check('an apostrophe in the copy survived the escaping',
    rows.some((r) => r.body.includes("someone else's post")),
    rows.find((r) => r.url === 'linkedin-comment-drafter.zip'));
}

console.log('\nPrompt Library skills — safe to run again');
{
  await db.exec(sql(SKILLS_MIGRATION));
  const rows = await skills();
  check('running it twice inserts nothing new', rows.length === 15, rows.length);
  check('and no pack is wired twice',
    new Set(rows.map((r) => r.url)).size === rows.length,
    rows.map((r) => r.url));

  // A pack that has been moved to a later week must not reappear in week 0.
  await db.exec("update public.portal_items set week_id = 4 where url = 'linkedin-post-writer.zip'");
  await db.exec(sql(SKILLS_MIGRATION));
  const moved = await skills();
  check('a pack moved to another week is left where it is',
    moved.length === 15 && moved.filter((r) => r.url === 'linkedin-post-writer.zip').length === 1 &&
    moved.find((r) => r.url === 'linkedin-post-writer.zip').week_id === 4,
    moved.filter((r) => r.url === 'linkedin-post-writer.zip'));

  // put it back, so the next block sees what the migration actually makes
  await db.exec("update public.portal_items set week_id = 3 where url = 'linkedin-post-writer.zip'");
}

console.log('\nPrompt Library skills — the rows match the cards');
{
  const js = readFileSync(new URL('../../portal/portal-prompts.js', import.meta.url), 'utf8');
  const cardFiles = [...js.matchAll(/file: '([^']+)'/g)].map((m) => m[1]);
  const rows = await skills();
  const wired = new Set(rows.map((r) => r.url));

  check('sixteen cards on the page', cardFiles.length === 16, cardFiles.length);
  check('every wired pack belongs to a card on the page',
    rows.every((r) => cardFiles.includes(r.url)),
    rows.map((r) => r.url).filter((u) => !cardFiles.includes(u)));

  // A card used to carry the week its pack unlocked in, so the page could say
  // "Download unlocks Week 3". The Prompt Library hands over a prompt now and
  // gates nothing, so there is no week on a card to disagree with the row.
  check('no card claims a week any more, because nothing on the page is gated',
    !/week: \d+/.test(js), (js.match(/.{0,40}week: \d+.{0,20}/) || [])[0]);

  const unwired = cardFiles.filter((f) => !wired.has(f));
  check('exactly one card is still waiting on its pack',
    unwired.length === 1 && unwired[0] === 'audit-linkedin-for-icp-goal.zip', unwired);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

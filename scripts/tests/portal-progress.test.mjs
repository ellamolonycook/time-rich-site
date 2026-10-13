// Account-level curriculum progress: the schema, migration and RPC contract.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

const sql = (path) => readFileSync(new URL('../../supabase/' + path, import.meta.url), 'utf8');
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(sql('portal_schema.sql'));
await db.exec(sql('migrations/20261010090000_portal_email_login_and_addevent.sql'));
await db.exec(sql('migrations/20261013100000_portal_member_progress.sql'));

let pass = 0, fail = 0;
function check(name, condition, extra) {
  if (condition) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const member = (await db.query(
  "insert into public.portal_members (full_name, email) values ('Ella Example', 'ella@example.com') returning id"
)).rows[0];
await db.exec("update public.portal_weeks set release_at = now() - interval '1 day' where id = 0");
const item = (await db.query(
  "insert into public.portal_items (week_id, kind, title, published) values (0, 'text', 'Welcome', true) returning id"
)).rows[0];
const session = (await db.query(
  "insert into public.portal_sessions (week_id, title, starts_at) values (0, 'Live Q&A', now()) returning id"
)).rows[0];
await db.exec(`insert into public.portal_login_sessions (token, member_id, expires_at)
  values ('good-token', '${member.id}', now() + interval '1 day')`);

console.log('\nPortal progress — database model and RPC');
{
  const marked = await db.query(
    'select public.portal_set_progress($1, $2, null, true) as result',
    ['good-token', item.id]
  );
  check('marks an unlocked published curriculum item', marked.rows[0].result.ok === true, marked.rows[0].result);

  const again = await db.query(
    'select public.portal_set_progress($1, $2, null, true) as result',
    ['good-token', item.id]
  );
  const rows = await db.query('select member_id, item_id from public.portal_member_progress where item_id = $1', [item.id]);
  check('marking the same item twice leaves one row', again.rows[0].result.ok === true && rows.rows.length === 1, rows.rows);

  const attended = await db.query(
    'select public.portal_set_progress($1, null, $2, true) as result',
    ['good-token', session.id]
  );
  check('also persists a session tick independently', attended.rows[0].result.ok === true, attended.rows[0].result);

  const payload = await db.query("select public.portal_get_by_token('good-token') as result");
  check('the signed-in payload returns both completion sets',
    payload.rows[0].result.progress.items.includes(item.id) &&
    payload.rows[0].result.progress.sessions.includes(session.id), payload.rows[0].result.progress);

  const cleared = await db.query(
    'select public.portal_set_progress($1, $2, null, false) as result',
    ['good-token', item.id]
  );
  const afterClear = await db.query('select count(*)::int as count from public.portal_member_progress where item_id = $1', [item.id]);
  check('unchecking removes only that item completion', cleared.rows[0].result.ok === true && afterClear.rows[0].count === 0, afterClear.rows[0]);

  const badToken = await db.query(
    'select public.portal_set_progress($1, $2, null, true) as result',
    ['bad-token', item.id]
  );
  check('an unknown token cannot write progress', badToken.rows[0].result.ok === false, badToken.rows[0].result);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

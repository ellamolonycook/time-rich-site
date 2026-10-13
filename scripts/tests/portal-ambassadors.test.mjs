// The launch fixes that live in SQL, run for real in PGlite: the bonus
// session and ambassador access. Schema first, then every migration in
// filename order, which is the order they are meant to be applied.
//
// The rule these exist to pin: filling in the public /superhuman form can
// never, on its own, create a portal member. Access comes from the
// allowlist, and an ambassador upsert must not demote anybody.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const repoRoot = new URL('../../', import.meta.url);
const root = new URL('supabase/', repoRoot);
const sql = (path) => readFileSync(new URL(path, root), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });
// Supabase's roles, created first so the migrations run the way they do on
// the real database: the guarded blocks take their live branch, and the one
// unguarded `grant ... to service_role` does not fall over on plain Postgres.
await db.exec(`do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;`);
await db.exec(sql('portal_schema.sql'));
const MIGRATIONS = readdirSync(new URL('migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
for (const file of MIGRATIONS) await db.exec(sql('migrations/' + file));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
const one = async (text, params) => (await db.query(text, params)).rows[0];
const all = async (text, params) => (await db.query(text, params)).rows;

console.log('\nPortal — the bonus session');
{
  // The seed leaves join_url null, so give the existing rows the one
  // recurring link the way production has it, then re-run the migration
  // to prove it copies rather than inventing a URL.
  await db.exec(`update public.portal_sessions set join_url = 'https://example-zoom.test/j/000'`);
  const bonusFile = MIGRATIONS.find((f) => f.includes('bonus_session'));
  await db.exec(sql('migrations/' + bonusFile));

  const rows = await all(`select title, week_id, starts_at, join_url, addevent_url
                            from public.portal_sessions order by starts_at`);
  check('ten sessions once the bonus is in', rows.length === 10, rows.length);

  const bonus = rows.find((r) => r.title.startsWith('Bonus: '));
  check('the title keeps the "Bonus: " prefix the front end looks for',
    bonus && bonus.title === 'Bonus: Multi-LLM & Setting Your Harness', bonus && bonus.title);
  check('it is session 2 of 10 by date',
    rows.indexOf(bonus) === 1, rows.map((r) => r.title));
  check('it carries its own Add to Calendar page',
    bonus.addevent_url === 'https://www.addevent.com/event/zt2r86vdvnsm', bonus.addevent_url);
  check('its Zoom link was copied from a sibling, not written into the repo',
    bonus.join_url === 'https://example-zoom.test/j/000', bonus.join_url);
  check('every session now shares one Zoom link',
    new Set(rows.map((r) => r.join_url)).size === 1);

  await db.exec(sql('migrations/' + bonusFile));
  const again = await all(`select 1 from public.portal_sessions where title like 'Bonus:%'`);
  check('running the migration twice adds nothing', again.length === 1, again.length);
}

console.log('\nPortal — the allowlist itself');
{
  check('ambassador is a role the table accepts',
    !!(await one(`select 1 as ok from pg_constraint
                   where conname = 'portal_members_role_check'
                     and pg_get_constraintdef(oid) like '%ambassador%'`)));
  check('the allowlist has row level security on',
    (await one(`select relrowsecurity as on from pg_class where relname = 'portal_ambassador_allowlist'`)).on === true);
  check('and no policies, so nothing public can read it',
    (await all(`select 1 from pg_policies where tablename = 'portal_ambassador_allowlist'`)).length === 0);
  check('emails are stored lowercase by constraint',
    !!(await one(`select 1 as ok from pg_constraint
                   where conname = 'portal_ambassador_allowlist_email_normalized'`)));
}

console.log('\nPortal — who the form can and cannot let in');
{
  // Nobody is allowlisted yet: the form answer alone must do nothing.
  check('an address nobody approved is not an ambassador',
    (await one(`select public.portal_ambassador_allowed('chancer@example.com') as ok`)).ok === false);

  await db.query(`select public.add_ambassador('amb@example.com', 'Amba Sador')`);
  check('an approved address is',
    (await one(`select public.portal_ambassador_allowed('amb@example.com') as ok`)).ok === true);
  check('case and padding do not matter',
    (await one(`select public.portal_ambassador_allowed('  AMB@Example.COM ') as ok`)).ok === true);

  const row = await one(`select role, active from public.portal_members where email = 'amb@example.com'`);
  check('add_ambassador creates the member row too', row && row.role === 'ambassador', row);
  check('and the row is active, so they can sign in', row && row.active === true);

  await db.query(`select public.add_ambassador('amb@example.com', 'Amba Sador')`);
  check('running add_ambassador twice leaves one member row',
    (await all(`select 1 from public.portal_members where email = 'amb@example.com'`)).length === 1);
}

console.log('\nPortal — an ambassador never outranks a paid seat');
{
  await db.query(`select public.portal_upsert_member('buyer@example.com', 'Paid Buyer', 'buyer', 'TC-1')`);
  await db.query(`select public.portal_upsert_member('buyer@example.com', 'Paid Buyer', 'ambassador', null)`);
  const buyer = await one(`select role, order_id from public.portal_members where email = 'buyer@example.com'`);
  check('a buyer is not demoted to ambassador', buyer.role === 'buyer', buyer);
  check('and keeps their order id', buyer.order_id === 'TC-1', buyer.order_id);

  await db.query(`select public.portal_upsert_member('seat@example.com', 'Second Seat', 'second_seat', 'TC-2')`);
  await db.query(`select public.portal_upsert_member('seat@example.com', 'Second Seat', 'ambassador', null)`);
  check('a second seat is not demoted either',
    (await one(`select role from public.portal_members where email = 'seat@example.com'`)).role === 'second_seat');

  await db.exec(`insert into public.portal_members (full_name, email, role) values ('Staff', 'team@example.com', 'team')`);
  await db.query(`select public.portal_upsert_member('team@example.com', 'Staff', 'ambassador', null)`);
  check('a team row is untouched',
    (await one(`select role from public.portal_members where email = 'team@example.com'`)).role === 'team');

  await db.query(`select public.add_ambassador('buyer@example.com', 'Paid Buyer')`);
  check('add_ambassador allowlists a buyer without demoting them',
    (await one(`select role from public.portal_members where email = 'buyer@example.com'`)).role === 'buyer');

  // The other direction still has to work: buying a seat upgrades you.
  await db.query(`select public.portal_upsert_member('amb@example.com', 'Amba Sador', 'buyer', 'TC-9')`);
  check('an ambassador who later buys is upgraded',
    (await one(`select role from public.portal_members where email = 'amb@example.com'`)).role === 'buyer');
}

console.log('\nPortal — an ambassador signs in and sees the buyer view');
{
  await db.query(`select public.add_ambassador('amb2@example.com', 'Second Amba')`);
  const login = await one(`select public.portal_login('amb2@example.com') as payload`);
  const payload = login.payload;
  check('email-only sign-in works for an ambassador', payload && payload.ok === true, payload && payload.ok);
  check('and the payload names the role', payload.member && payload.member.role === 'ambassador', payload.member);
  check('with the same weeks a buyer gets', Array.isArray(payload.weeks) && payload.weeks.length === 5,
    payload.weeks && payload.weeks.length);
  check('and the sessions list, bonus included',
    Array.isArray(payload.sessions) && payload.sessions.length === 10, payload.sessions && payload.sessions.length);
}

console.log('\nPortal — the Zoom link stays out of the repository');
{
  // Every session shares one recurring Zoom link, and it is a joining
  // secret: the migration copies it from a sibling row rather than
  // writing it down. Scoped to what ships -- the two fake zoom.us/j/1
  // fixtures in this folder are test data, not a leak.
  const SHIPPED = ['supabase/', 'worker/', 'portal/'];
  const tracked = execSync('git ls-files', { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').map((f) => f.trim())
    .filter((f) => f && SHIPPED.some((dir) => f.startsWith(dir)));
  const offenders = [];
  for (const file of tracked) {
    let text;
    try { text = readFileSync(new URL(file, repoRoot), 'utf8'); } catch { continue; }
    if (/zoom\.us|zoom\.com\/j\//i.test(text)) offenders.push(file);
  }
  check('no Zoom URL in anything that ships', offenders.length === 0, offenders);
  check('and the guard is actually looking at files', tracked.length > 10, tracked.length);

  const migration = readFileSync(new URL('migrations/' + MIGRATIONS.find((f) => f.includes('bonus_session')), root), 'utf8');
  check('the bonus migration reads the link from an existing row',
    /select\s+s\.join_url/.test(migration) && !/https?:\/\/[^\/]*zoom/i.test(migration));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

// portal_upsert_member tests: run the real schema and migration in PGlite
// (Postgres in WASM, in-process), then assert on the rows the function leaves.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

const sql = (path) => readFileSync(new URL('../../supabase/' + path, import.meta.url), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(sql('portal_schema.sql'));
await db.exec(sql('migrations/20261005_portal_member_upsert.sql'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + JSON.stringify(extra) : '')); }
}

const upsert = async (email, name, role, orderId) =>
  (await db.query('select public.portal_upsert_member($1, $2, $3, $4) as r', [email, name, role, orderId])).rows[0].r;
const member = async (email) =>
  (await db.query('select role, order_id, passcode, active from public.portal_members where email = $1', [email])).rows[0];

console.log('\nportal_upsert_member — team rows are untouchable');
{
  await db.query("insert into public.portal_members (email, full_name, role, order_id) values ('staff@timerich.ai', 'Staff', 'team', null)");
  const before = await member('staff@timerich.ai');

  const r = await upsert('staff@timerich.ai', 'Staff', 'buyer', 'order-100');
  const after = await member('staff@timerich.ai');
  check('buyer upsert on a team row returns ok, not created', r.ok === true && r.created === false, r);
  check('buyer upsert keeps role team', after.role === 'team', after);
  check('buyer upsert keeps order_id', after.order_id === null, after);
  check('passcode unchanged', after.passcode === before.passcode);

  await upsert('Staff@TimeRich.ai ', 'Staff', 'second_seat', 'order-200');
  const after2 = await member('staff@timerich.ai');
  check('second_seat upsert keeps role team', after2.role === 'team', after2);
  check('second_seat upsert keeps order_id', after2.order_id === null, after2);
}

console.log('\nportal_upsert_member — buyer and second_seat');
{
  const r = await upsert('Buyer@Example.com', 'Buyer One', 'buyer', 'order-1');
  const b = await member('buyer@example.com');
  check('new buyer is created with a normalised email', r.created === true && b && b.role === 'buyer' && b.order_id === 'order-1', b);

  await upsert('buyer@example.com', 'Buyer One', 'second_seat', 'order-9');
  const b2 = await member('buyer@example.com');
  check('second_seat upsert on a buyer keeps role and order_id', b2.role === 'buyer' && b2.order_id === 'order-1', b2);

  await upsert('plusone@example.com', 'Plus One', 'second_seat', 'order-2');
  await upsert('plusone@example.com', 'Plus One', 'buyer', 'order-3');
  const p = await member('plusone@example.com');
  check('buyer upsert upgrades a second_seat row', p.role === 'buyer' && p.order_id === 'order-3', p);

  await db.query("update public.portal_members set active = false where email = 'plusone@example.com'");
  await upsert('plusone@example.com', 'Plus One', 'buyer', 'order-3');
  check('upsert never switches an inactive member back on', (await member('plusone@example.com')).active === false);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

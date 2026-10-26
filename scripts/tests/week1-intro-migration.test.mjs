// The 25 Oct curriculum migration, run for real.
//
// Ella runs this by hand in Supabase after the PR merges, so "it looks
// right" is not good enough: a typo in a substring() or a dollar-quote and
// she is looking at a red box with a cohort waiting. This runs the file
// against Postgres (PGlite, in-process) on rows seeded with exactly what is
// in the portal today, and checks what comes out the other side.
//
// It also runs it twice. Every migration in this folder is written to be
// safe to run again, and the only way to know is to do it.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

/* Line endings are normalised to LF, which is what git stores and what
   Supabase is handed. The working tree on Windows is CRLF, and reading it
   raw would put a carriage return inside every dollar-quoted body. */
const sql = (p) => readFileSync(new URL('../../supabase/' + p, import.meta.url), 'utf8')
  .replace(/\r\n?/g, '\n');
const MIGRATION = sql('migrations/20261025200000_week1_intro_north_star.sql');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/* The three rows as they stand, lifted from the migrations that wrote them:
   20261024120000_start_here_five_steps.sql for the first, and
   20261023120000_week1_club_v2.sql for the other two. */
const BEFORE_INTRO = `Who you are, what you sell, and your Q4 North Star with a number. After that, ask in the channel that fits so the right expert sees it.

+ The channels, and where to ask
#introductions
Say hello and share your Q4 North Star with an outcome.
#superhuman-accelerator
Announcements, session links and the week's Audacious Action.
#audacious-wins
Post every win, big or small!!!`;

const BEFORE_PAPER = `Before you open any AI, write by hand:

1. Q4 North Star: one result by 31 December, with a number.
2. Q1 North Star: one result by 31 March, with a number.
3. The highest value use of your time that is non-negotiable for your business. For example: sales calls with new clients, because nobody else can do them yet.
4. What you'll stop doing to make room for it.
5. Hours a week you'll give this.

Then ask yourself: if this was the only thing you achieved this quarter, would it be enough?`;

const BEFORE_AUDIT = `Paste your 2-minute voice note of last week (or your calendar) at the end of this prompt, in your Business Hub. You get your revenue number and your first 3 hand-offs.

Run a Time Rich Audit on my last week. Read my Business COMPASS first if it's in this project. If it's missing or empty, ask me the 3 questions you need before you start.

1. List every task over 15 minutes with its hours.
2. Mark a task $ only if it put me in front of someone who can pay me this month AND it sells one of my offers.
3. Give me my revenue number: the percentage of my hours that were $ tasks.

Don't invent tasks, hours or offers. If something is missing, ask me before you guess.

My last week:`;

const BEFORE_HUB = `In Claude, open Projects, press New project and name it Business Hub. Paste this into the instructions, then add your COMPASS to the project's Files:

"This is my Business Hub. Read my Business COMPASS in this project's files before any task. If something is missing, ask me before you guess."`;

const BEFORE_WISPR = `Open a new chat in your Business Hub, paste this, then hold your Wispr key and read your Q4 and Q1 goals from your paper:

Here is my North Star: (read out your Q4 and Q1 goals).

Play each one back to me in one line. Tell me if each has a number and a date. Then ask me the one question that would make it sharper. Keep it, because every prompt after this works towards it.`;

const db = new PGlite();

/* The columns this migration touches. The real table has more, and the real
   one is what Ella runs against; what matters here is that the statements
   parse, match the right rows and leave the right text. */
await db.exec(`
  create table public.portal_items (
    id serial primary key,
    week_id integer not null,
    kind text not null default 'text',
    title text not null,
    body text,
    url text,
    sort integer not null default 0,
    published boolean not null default true
  );
`);

const seed = async () => {
  await db.exec('truncate public.portal_items restart identity;');
  await db.query(
    `insert into public.portal_items (week_id, title, body, sort) values
       (0, 'Say hello in #introductions', $1, 130),
       (1, 'Write your North Star on paper', $2, 20),
       (1, 'Wispr your North Star into your Business Hub', $3, 30),
       (1, 'Run your Time Rich Audit', $4, 40),
       (1, 'Monday 26 October: Open Business Surgery', 'Untouched by this migration.', 10),
       (0, 'Create your Business Hub', $5, 430)`,
    [BEFORE_INTRO, BEFORE_PAPER, BEFORE_WISPR, BEFORE_AUDIT, BEFORE_HUB]);
  // A row on the old voucher, so the sweep in step 6 has something to fix.
  await db.query(
    `insert into public.portal_items (week_id, kind, title, body, url, sort) values
       (0, 'link', 'Claim 3 months of LaunchLemonade', 'An older row.',
        'https://studio.launchlemonade.app/signup?voucher=ACCELERATOR', 520)`);
};

const bodyOf = async (title) =>
  (await db.query('select body, id from public.portal_items where title = $1', [title])).rows[0];

await seed();
const idsBefore = (await db.query('select id, title from public.portal_items order by id')).rows;

console.log('\nThe migration runs');
{
  let error = null;
  try { await db.exec(MIGRATION); } catch (e) { error = e; }
  check('without an error', error === null, error && String(error.message || error));
}

console.log('\n1. The #introductions row is renamed, and carries the format');
{
  check('it was seeded under the old name',
    (await bodyOf('Say hello in #introductions')) === undefined);
  const row = await bodyOf('Introduce yourself in #introductions');
  check('and answers to the new one', Boolean(row));
  const body = row.body;

  check('it opens with the new line',
    body.startsWith('Introduce yourself in Slack in this format. Please keep it short and clear!'),
    body.slice(0, 60));
  check('and the line it replaced is gone',
    !body.includes('Who you are, what you sell'));

  check('the copy box is marked', body.includes('\n= Copy: Your intro\n'));
  for (const line of [
    "1. Name, company, city. Where you're based.",
    '2. What your business does. The problem you solve, in one sentence.',
    '3. Your Q4 North Star. One target, with a number and a date. Example: "3 new retainer clients by 31 December."',
    '4. Your superpower. What you can help the other founders with.',
    "5. What you're most excited about in the accelerator.",
    '6. LinkedIn. Full link, so people can connect.',
  ]) {
    check('it carries: ' + line.slice(0, 28) + '...', body.includes(line), body);
  }

  // The drop-down under it is carried over whole, and still after the box.
  check('the channels drop-down is still there',
    body.includes('+ The channels, and where to ask'));
  check('with its channels', body.includes('#superhuman-accelerator') &&
    body.includes('Post every win, big or small!!!'));
  check('and it comes after the copy box',
    body.indexOf('= Copy: Your intro') < body.indexOf('+ The channels'));

  /* The box has to END before the drop-down, which is what the blank line
     between them does: the renderer closes a copy block at the first blank
     line followed by a line hard against the margin. */
  check('a blank line closes the box before the drop-down',
    body.includes('6. LinkedIn. Full link, so people can connect.\n\n+ The channels'),
    JSON.stringify(body.slice(body.indexOf('6. LinkedIn'))).slice(0, 120));
}

console.log('\n2. The North Star on paper is four questions');
{
  const body = (await bodyOf('Write your North Star on paper')).body;

  check('the line above them is untouched',
    body.startsWith('Before you open any AI, write by hand:'), body.slice(0, 50));
  check('and the question under them',
    body.trim().endsWith('would it be enough?'), body.slice(-40));

  const list = body.split('\n\n')[1];
  check('the four questions, exactly as Ella wrote them',
    list === [
      '1. Q4: 1 specific target by 31 December, with a number',
      '2. Where should my time be invested?',
      "3. What I'll stop doing",
      '4. 1 hour daily commitment',
    ].join('\n'), JSON.stringify(list));

  check('the fifth question is gone', !body.includes('Hours a week you\'ll give this'));
  check('and so is the Q1 North Star', !body.includes('Q1 North Star'));
  check('three paragraphs, nothing left over', body.split('\n\n').length === 3,
    body.split('\n\n').length);
}

console.log('\n3. The Wispr prompt reads back the four answers');
{
  const body = (await bodyOf('Wispr your North Star into your Business Hub')).body;
  check('the prompt asks for the 4 answers', body.includes('(read out your 4 answers)'), body);
  check('and so does the line that tells the member what to read out',
    body.startsWith('Open a new chat in your Business Hub, paste this, then hold your Wispr key and read your 4 answers from your paper:'),
    body.slice(0, 120));
  // Both mentions, or the row contradicts the four questions above it.
  check('no Q4 and Q1 goals anywhere in the row',
    !body.includes('Q4 and Q1 goals'), body);
  check('the rest of the prompt is untouched',
    body.includes('Play each one back to me in one line.'));
}

console.log('\n7. The Business Hub row carries the connectors drop-down');
{
  const row = await bodyOf('Create your Business Hub');
  check('the row is still there', Boolean(row));

  const meta = (await db.query(
    "select title, kind, sort from public.portal_items where title = 'Create your Business Hub'")).rows;
  check('with its title, kind and sort untouched',
    meta.length === 1 && meta[0].kind === 'text' && meta[0].sort === 430, meta);

  const body = row.body;
  check('the instructions it always had are still first',
    body.startsWith('In Claude, open Projects, press New project and name it Business Hub.'),
    body.slice(0, 60));
  check('with the project instructions, in quotes',
    body.includes('"This is my Business Hub. Read my Business COMPASS in this project\'s files before any task. If something is missing, ask me before you guess."'));
  check('then the line about where prompts run',
    body.includes('Every prompt in the accelerator runs in a chat inside your Business Hub.'));

  /* The drop-down. A "+ " line opens one in bodyBlocks(), and it only does
     so when the marker starts its own line, so that is what is checked
     rather than the words alone. */
  check('the connectors are a "+ " drop-down',
    body.includes('\n+ How to add your connectors\n'), body);
  check('named as Ella named it',
    /^\+ How to add your connectors$/m.test(body));
  for (const line of [
    '1. In Claude, open Settings, then Connectors.',
    '2. Press Browse connectors and add Gmail, Google Calendar and Google Drive, or Notion if that\'s where your docs live. Press Connect, sign in and allow access.',
    '3. Wispr Flow: in the Wispr Flow app, open Settings, MCP, then Add to Claude.',
    '4. In a chat inside your Business Hub, press the + button in the message box and check your connectors are switched on.',
    '5. Test it: ask "What\'s on my calendar this week?"',
  ]) {
    check('it carries: ' + line.slice(0, 30) + '...', body.includes(line), body);
  }
  check('and ends on the line about approval',
    body.trim().endsWith('Nothing sends, posts or deletes without your yes.'), body.slice(-60));

  // Everything after the marker belongs to the drop-down, and the five
  // steps are inside it rather than above it.
  const inside = body.split('\n+ How to add your connectors\n')[1];
  check('all five steps are inside the drop-down',
    inside.includes('1. In Claude, open Settings') && inside.includes('5. Test it:'), inside.slice(0, 40));
  check('and no carriage returns in it', !body.includes('\r'));
}

console.log('\n5. Step 6: before Wednesday\'s live build');
{
  const row = await bodyOf('Sign up to LaunchLemonade (3 months free)');
  check('the row is there', Boolean(row));
  const got = (await db.query(
    "select kind, url, sort, published from public.portal_items where title = 'Sign up to LaunchLemonade (3 months free)'")).rows;
  check('one of it, not two', got.length === 1, got.length);
  check('a link, in step 6, published',
    got[0].kind === 'link' && got[0].sort === 610 && got[0].published === true, got[0]);
  check('pointing at the TIMERICHLL voucher',
    got[0].url === 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL', got[0].url);

  const body = row.body;
  check('it opens on the session it is for',
    body.startsWith("Before Wednesday's live build session with Multi LLM & Setting Up Your Harness:"),
    body.slice(0, 60));
  for (const line of [
    '1. Sign up to LaunchLemonade (3 months free) using the button below.',
    '2. Log in and check that you can access your account.',
    "That's all you need to do before the session.",
    'If you already have an account, just check that you can log in.',
    'Any issues? Email Wilfred Soriaga at wilfredsoriaga@launchlemonade.app or DM in Slack.',
  ]) {
    check('it carries: ' + line.slice(0, 30) + '...', body.includes(line), body);
  }
  check('and no carriage returns in it', !body.includes('\r'));
}

console.log('\n6. The LaunchLemonade voucher, everywhere');
{
  const rows = (await db.query(
    "select title, url from public.portal_items where url like '%launchlemonade.app%'")).rows;
  check('every LaunchLemonade link is the TIMERICHLL one',
    rows.length > 0 && rows.every((r) => r.url === 'https://studio.launchlemonade.app/signup?voucher=TIMERICHLL'),
    rows);
  check('and the old voucher is gone',
    !rows.some((r) => /ACCELERATOR/.test(r.url)), rows.map((r) => r.url));
}

console.log('\n4. The audit prompt is in a copy box');
{
  const body = (await bodyOf('Run your Time Rich Audit')).body;

  check('the marker is on its own line, straight above the prompt',
    body.includes('\n= Copy: Your audit prompt\nRun a Time Rich Audit on my last week.'),
    body.slice(0, 200));
  check('the line above it stays outside the box',
    body.startsWith('Paste your 2-minute voice note of last week'), body.slice(0, 50));
  check('and the box runs to the end of the row',
    body.trim().endsWith('My last week:'), body.slice(-30));

  // Not a word of Ella's prompt changes: only a line is inserted.
  check('the prompt itself is untouched',
    body.replace('= Copy: Your audit prompt\n', '') === BEFORE_AUDIT,
    JSON.stringify(body.replace('= Copy: Your audit prompt\n', '').slice(0, 80)));

  check('one marker, not two',
    body.split('= Copy:').length - 1 === 1, body.split('= Copy:').length - 1);

  /* What the member will actually copy: the renderer takes everything from
     the marker to the end of the body, blank lines and all. Nothing here
     may cut it short at the first paragraph break. */
  const copied = body.split('= Copy: Your audit prompt\n')[1];
  check('every paragraph of the prompt is inside the box',
    copied.includes('1. List every task over 15 minutes') &&
    copied.includes("Don't invent tasks, hours or offers.") &&
    copied.trim().endsWith('My last week:'), copied.slice(0, 60));
  check('and the four blank lines inside it survive',
    copied.split('\n\n').length === 4, copied.split('\n\n').length);
}

console.log('\nNothing else moved, and no tick was lost');
{
  const untouched = (await bodyOf('Monday 26 October: Open Business Surgery')).body;
  check('a row the migration does not name is left alone',
    untouched === 'Untouched by this migration.', untouched);

  // Every row keeps its id, which is what a member's tick points at.
  const idsAfter = (await db.query('select id, title from public.portal_items order by id')).rows;
  // Every row that was there keeps its id, which is what a member's tick
  // points at. The title of one of them changed, so ids are compared alone.
  check('every row keeps its id',
    JSON.stringify(idsBefore.map((r) => r.id)) ===
    JSON.stringify(idsAfter.slice(0, idsBefore.length).map((r) => r.id)),
    { idsBefore, idsAfter });
  // One row goes in: step 6. Nothing is deleted.
  check('only the new step was added', idsAfter.length === idsBefore.length + 1,
    [idsBefore.length, idsAfter.length]);
}

console.log('\nRunning it a second time changes nothing');
{
  const before = (await db.query('select title, body from public.portal_items order by id')).rows;
  let error = null;
  try { await db.exec(MIGRATION); } catch (e) { error = e; }
  check('the second run succeeds too', error === null, error && String(error.message || error));

  const after = (await db.query('select title, body from public.portal_items order by id')).rows;
  check('and leaves every body byte for byte as it was',
    JSON.stringify(after) === JSON.stringify(before),
    after.filter((r, i) => r.body !== before[i].body).map((r) => r.title));
}

console.log('\nThe checks inside it really do fire');
{
  // A migration whose checks never fail is a migration that cannot tell you
  // it did nothing. This proves the raise is reachable: with the drop-down
  // missing, the first update matches nothing and the check should stop it.
  await db.exec('truncate public.portal_items restart identity;');
  await db.query(
    `insert into public.portal_items (week_id, title, body, sort) values
       (0, 'Say hello in #introductions', 'Who you are, what you sell. No drop-down here.', 130),
       (1, 'Write your North Star on paper', $1, 20),
       (1, 'Wispr your North Star into your Business Hub', $2, 30),
       (1, 'Run your Time Rich Audit', $3, 40)`,
    [BEFORE_PAPER, BEFORE_WISPR, BEFORE_AUDIT]);

  let error = null;
  try { await db.exec(MIGRATION); } catch (e) { error = e; }
  check('it refuses rather than leaving half the change in',
    error !== null && /#introductions row is missing/.test(String(error.message || error)),
    error && String(error.message || error));

  // The raise left the transaction open and aborted, exactly as it would in
  // Supabase. Closing it is what makes the rest of this readable.
  try { await db.exec('rollback;'); } catch (e) { /* already closed */ }

  const body = (await bodyOf('Wispr your North Star into your Business Hub')).body;
  check('and the transaction rolled back, so nothing else changed',
    body === BEFORE_WISPR, body.slice(0, 60));
}

await db.close();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

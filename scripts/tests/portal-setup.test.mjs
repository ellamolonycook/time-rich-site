import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { JSDOM } from 'jsdom';
import worker from '../../worker/src/index.js';
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
let checks = 0;
function check(label, value) { assert.ok(value, label); checks++; console.log('  ok   ' + label); }
const db = new PGlite({ extensions: { pgcrypto } });
for (const file of ['portal_schema.sql', 'migrations/20261010090000_portal_email_login_and_addevent.sql', 'migrations/20261013100000_portal_member_progress.sql', 'migrations/20261016090000_portal_setup.sql']) await db.exec(read('supabase/' + file));
const member = (await db.query("insert into portal_members(full_name,email) values ('Member One','one@example.com') returning id")).rows[0];
const other = (await db.query("insert into portal_members(full_name,email) values ('Member Two','two@example.com') returning id")).rows[0];
await db.query("insert into portal_login_sessions(token,member_id,expires_at) values ('valid',$1,now()+interval '1 day'),('expired',$1,now()-interval '1 day')",[member.id]);
const set = async (token,step,done) => (await db.query('select portal_set_setup($1,$2,$3) as result',[token,step,done])).rows[0].result.ok;
const payload = async () => (await db.query("select portal_get_by_token('valid') as result")).rows[0].result;
check('new member starts with both steps incomplete', (await payload()).member.setup.calendar === false && (await payload()).member.setup.notion === false);
check('calendar completion persists', await set('valid','calendar',true) && (await payload()).member.setup.calendar === true);
check('Notion completion persists independently', await set('valid','notion',true) && (await payload()).member.setup.calendar === true && (await payload()).member.setup.notion === true);
check('repeat completion is idempotent', await set('valid','notion',true));
check('undo only clears the chosen step', await set('valid','calendar',false) && !(await payload()).member.setup.calendar && (await payload()).member.setup.notion);
check('other members are unchanged', !(await db.query('select setup from portal_members where id=$1',[other.id])).rows[0].setup.notion);
for (const [token,step,done] of [['bad','calendar',true],['expired','calendar',true],['valid','role',true],['valid',null,true],['valid','notion',null]]) check('rejects invalid setup update ' + [token,step,done].join('/'), !await set(token,step,done));
await db.query('update portal_members set active=false where id=$1',[member.id]);
check('inactive member cannot write', !await set('valid','calendar',true));
await db.close();

const env={SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test',ALLOWED_ORIGIN:'https://timerich.ai'};
let requestBody, requestUrl, responseOk = true;
globalThis.fetch=async (url,init) => { requestUrl=url; requestBody=JSON.parse(init.body); return Response.json({ok:responseOk}); };
const post=body => worker.fetch(new Request('https://worker.test/portal-progress',{method:'POST',headers:{Origin:'https://timerich.ai','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
check('Worker accepts setup on the authenticated progress route',(await post({token:'valid',setup_step:'calendar',done:true})).status===200);
check('Worker calls the setup RPC with only supported arguments',requestUrl.endsWith('/portal_set_setup') && JSON.stringify(requestBody)===JSON.stringify({p_token:'valid',p_step:'calendar',p_done:true}));
for (const extra of [{setup_step:'role'},{item_id:1},{session_id:2},{done:'true'}]) check('Worker rejects mixed or invalid inputs ' + JSON.stringify(extra),(await post({token:'valid',setup_step:'calendar',done:true,...extra})).status===400);
responseOk=false;
check('Worker rejects invalid member token',(await post({token:'bad',setup_step:'notion',done:true})).status===401);

/* The card draws one step. "Duplicate your Superhuman OS" used to sit beside
   it, saying the same thing as Step 1's "Duplicate the Superhuman Workbook"
   under a second name and marked Coming soon. The DB and the worker still
   carry the notion step -- the checks above pin that -- so an older member's
   saved tick is not lost; the card simply no longer asks for it. */
function boot(state={calendar:false,notion:false}, success=true) {
  const dom=new JSDOM('<section data-portal-setup hidden></section>',{runScripts:'dangerously',url:'https://timerich.ai/club/dashboard.html'});
  const w=dom.window;
  w.TR_PORTAL_DATA={member:{setup:{...state}},weeks:[],sessions:[]};
  w.TRPortal={setSetup:async()=>success};
  w.eval(read('club/portal-live.js')); w.eval(read('club/portal-setup.js'));
  return w;
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
let w=boot(),d=w.document;
check('exactly one subscribe button with the requested URL',d.querySelectorAll('a[href="https://www.addevent.com/calendar/z0j4nlqbgt6b"]').length===1 && d.querySelectorAll('a').length===1);
check('the calendar row is the only row, and it counts as one',
  d.querySelectorAll('.trp-setup-step').length===1 &&
  d.querySelector('.trp-setup-heading span').textContent==='0 of 1 complete',
  d.querySelector('.trp-setup-heading span').textContent);
// Step 1 already carries "Duplicate the Superhuman Workbook". The same task
// under a second name, on a second card, is the thing this card lost.
check('it does not ask for the Superhuman OS a second time',
  !d.body.textContent.includes('Superhuman OS') &&
  d.querySelector('[data-setup-step="notion"]')===null,
  (d.body.textContent.match(/.{0,30}Superhuman OS.{0,30}/) || [])[0]);
check('and nothing on the card reads "Coming soon"',
  !d.body.textContent.includes('Coming soon') &&
  d.querySelector('.trp-setup-actions button[disabled]')===null);
// A placeholder in brackets is somebody's TODO leaking onto the page.
check('no bracket placeholder renders anywhere on the card',
  !d.body.textContent.includes('['),
  (d.body.textContent.match(/.{0,30}\[.{0,30}/) || [])[0]);
d.querySelector('[data-setup-step="calendar"]').click();await flush();
check('the one step done collapses to Setup complete',d.querySelector('h2').textContent==='Setup complete' && !d.querySelector('ol'));
d.querySelector('button').click();
check('completed steps can be reviewed',d.querySelectorAll('[aria-pressed="true"]').length===1);
check('and the row shows the save that happened',d.querySelector('[data-setup-step="calendar"]').getAttribute('aria-pressed')==='true');
d.querySelector('[data-setup-step="calendar"]').click();await flush();
check('undo reopens setup',d.querySelector('h2').textContent==='Set up once' && d.querySelector('.trp-setup-heading span').textContent==='0 of 1 complete');w.close();
w=boot({calendar:true});
check('fresh page renders persisted completion',w.document.querySelector('h2').textContent==='Setup complete');w.close();
// An older member who ticked the Notion step before it went is not held
// open by a step the card no longer draws.
w=boot({calendar:true,notion:false});
check('a left-over notion flag does not keep the card open',w.document.querySelector('h2').textContent==='Setup complete');w.close();
w=boot(undefined,false);d=w.document;d.querySelector('[data-setup-step="calendar"]').click();await flush();
check('failed save leaves the step incomplete and offers retry',d.querySelector('[data-setup-step="calendar"]').getAttribute('aria-pressed')==='false' && d.querySelector('[role="status"]').textContent.includes('try again'));w.close();
w=boot();
const weeks=[{id:0,unlocked:true,title:'Start here',items:[{id:1,title:'Preparation'}]},{id:1,unlocked:false,title:'Week 1',release_at:'2030-01-01',items:[{id:2,title:'Locked material'}]},{id:2,unlocked:false,title:'Week 2'}];
const card=w.TRLive.learningCard({weeks},weeks[1],{sessions:true});
check('prep appears inside Week 1',card.textContent.includes('Week 1') && card.textContent.includes('Preparation'));
check('locked materials stay hidden',!card.textContent.includes('Locked material'));
check('grouping never changes source payload',weeks[1].unlocked===false && weeks[0].id===0 && weeks[1].items.length===1);
check('coming up does not duplicate Week 1',!w.TRLive.comingCard({weeks}).textContent.includes('Week 1'));

// A week row carries its body as well as its title. Week 1's hotkeys and its
// six voice prompts are all body, so a row that drew only the title would
// store that copy and never show it to anyone.
const NL = String.fromCharCode(10);
const BODY = 'Hold fn on Mac (Ctrl + Opt if your Mac has no fn key) or Ctrl + Win on Windows.' + NL + 'Speak, then let go.';
const withBody=[{id:0,unlocked:true,title:'Start here',items:[
  {id:1,title:'Turn it on',body:BODY},
  {id:2,title:'No body here'},
  {id:3,title:'Tagged <b>bold</b>',body:'Body with <b>markup</b> & an ampersand'}]},
  {id:1,unlocked:false,title:'Week 1',release_at:'2030-01-01',items:[]}];
const bodyCard=w.TRLive.learningCard({weeks:withBody},withBody[1],{sessions:false});
const rows=[...bodyCard.querySelectorAll('.trp-check-row')];
check('a week 0 item shows its body under the title',
  rows[0].querySelector('.trp-check-body') !== null &&
  rows[0].querySelector('.trp-check-body').textContent === BODY);
check('the body sits after the title, not in place of it',
  rows[0].textContent.indexOf('Turn it on') < rows[0].textContent.indexOf('Hold fn on Mac'));
check('the hotkey copy arrives whole',
  rows[0].textContent.includes('Ctrl + Opt if your Mac has no fn key') &&
  rows[0].textContent.includes('Ctrl + Win on Windows'));
check('an item with no body grows no empty line',
  rows[1].querySelector('.trp-check-body') === null);
check('a body is text, never markup',
  rows[2].querySelector('.trp-check-body').innerHTML === 'Body with &lt;b&gt;markup&lt;/b&gt; &amp; an ampersand' &&
  rows[2].querySelector('.trp-check-body').querySelector('b') === null);
check('line breaks in a body are kept by the stylesheet',
  /\.trp-check-body\s*\{[^}]*white-space:\s*pre-line/.test(read('club/portal-tailwind-src.css')) &&
  read('club/portal.css').includes('white-space:pre-line'));
w.close();
console.log(`\n${checks} setup checks passed`);

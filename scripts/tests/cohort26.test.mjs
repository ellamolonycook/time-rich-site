// /cohort26, the Superhuman Cohort 26 dashboard, run for real in jsdom.
//
// The page is one file with its own inline script, so these drive the markup
// the way a member would: type a code, press Enter, click through the tabs.
//
// The rules it exists to pin, in order of how much they would cost us:
//   1. The gate comes first and data.json is not fetched behind it. The data
//      is anonymous, but it is Ella's to show, not the web's to crawl.
//   2. A wrong code is refused and the right one opens it in any case.
//   3. The code itself is never in the page. Only its SHA-256 digest is.
//   4. Every chart, table and list is filled from data.json, and no count is
//      written into the HTML.
//   5. Nothing forces the page to scroll sideways on a phone: the one grid
//      too wide for 375px scrolls inside its own card.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const HTML = readFileSync(new URL('../../cohort26/index.html', import.meta.url), 'utf8');
const RAW = readFileSync(new URL('../../cohort26/data.json', import.meta.url), 'utf8');
const DATA = JSON.parse(RAW);

// The real code. It lives here, in the test, and nowhere in the page.
const CODE = 'SUPERHUMAN26';
const STORE_KEY = 'tr_cohort26_access';
// Every tab, and the id of the panel it opens.
const TABS = ['stages', 'agents', 'aios', 'content', 'story', 'leads', 'outcomes'];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

function rowsOf(table) { return DATA.filter((r) => r.table === table); }
function kpi(key) { return rowsOf('kpi').find((r) => r.key === key).value; }

/**
 * A fresh page with its inline script run.
 *   access   - a value to seed sessionStorage with (a member coming back)
 *   network  - 'ok' | 'error' | 'throw'
 *   storage  - 'blocked' makes every sessionStorage touch throw
 *   crypto   - 'missing' removes crypto.subtle (an insecure origin)
 */
function load(opts = {}) {
  const net = { calls: [], mode: opts.network || 'ok' };

  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/cohort26/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      // jsdom has neither of these, and the page needs both to hash a code.
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      Object.defineProperty(window, 'crypto', {
        configurable: true,
        value: opts.crypto === 'missing' ? { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } : webcrypto,
      });

      if (opts.access !== undefined) window.sessionStorage.setItem(STORE_KEY, opts.access);
      if (opts.storage === 'blocked') {
        Object.defineProperty(window, 'sessionStorage', {
          configurable: true,
          get() { throw new Error('storage is blocked'); },
        });
      }

      // jsdom ships no fetch, so this is the whole network.
      window.fetch = (url, init) => {
        net.calls.push({ url: String(url), init });
        if (net.mode === 'throw') return Promise.reject(new Error('Failed to fetch'));
        const ok = net.mode === 'ok';
        return Promise.resolve({
          ok,
          status: ok ? 200 : 502,
          json: () => Promise.resolve(JSON.parse(RAW)),
        });
      };
    },
  });

  const document = dom.window.document;
  const page = {
    dom,
    document,
    net,
    gate: () => document.getElementById('cx-gate'),
    shell: () => document.getElementById('cx-shell'),
    msg: () => document.getElementById('cx-gate-msg').textContent,
    stored: () => { try { return dom.window.sessionStorage.getItem(STORE_KEY); } catch (e) { return null; } },
    async enter(code) {
      document.getElementById('cx-code').value = code;
      document.getElementById('cx-gate-form')
        .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      await settle();
    },
    async tab(id) {
      document.getElementById('tab-' + id)
        .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await settle();
    },
    // Every slot the dashboard fills at runtime, on the tab that is open.
    slots(id) {
      return [...document.getElementById(id).querySelectorAll('.cx-chart, .cx-themes, .cx-list, .cx-stages')];
    },
  };
  return page;
}

// The hash and the fetch both land on the microtask queue after real work, so
// a few turns of the loop is what it takes for the page to settle.
async function settle() {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
}

console.log('/cohort26 — the gate comes first');
{
  const page = load();
  await settle();
  check('the gate is showing', page.gate().hidden === false);
  check('the dashboard is not', page.shell().hidden === true);
  check('data.json has not been fetched', page.net.calls.length === 0, page.net.calls);
  check('no chart has been drawn', page.slots('stages').every((s) => s.childElementCount === 0));
  check('and nothing is remembered yet', page.stored() === null, page.stored());

  // The gate card is the only thing on the page: a heading, a field, a button.
  const card = page.document.querySelector('.cx-gate-card');
  check('the card says what this is', card.querySelector('h1').textContent === 'Superhuman Cohort 26');
  check('it has one code field', card.querySelectorAll('input').length === 1);
  check('and an Enter button', card.querySelector('button[type=submit]').textContent.trim() === 'Enter');
}

console.log('\n/cohort26 — a wrong code is refused');
{
  const page = load();
  await settle();
  await page.enter('letmein');
  check('it says so', page.msg() === "That code isn't right.", page.msg());
  check('the dashboard stays shut', page.shell().hidden === true);
  check('data.json is still not fetched', page.net.calls.length === 0, page.net.calls);
  check('and nothing is remembered', page.stored() === null, page.stored());
}

console.log('\n/cohort26 — the right code opens it, in any case');
for (const typed of [CODE, CODE.toLowerCase(), '  ' + CODE.toLowerCase() + '  ', 'SuperHuman26']) {
  const page = load();
  await settle();
  await page.enter(typed);
  check('"' + typed + '" opens the dashboard',
    page.gate().hidden === true && page.shell().hidden === false);
  check('...and fetches data.json once',
    page.net.calls.length === 1 && /\/?data\.json$/.test(page.net.calls[0].url),
    page.net.calls.map((c) => c.url));
}

console.log('\n/cohort26 — the code itself is not in the page');
{
  check('the plain code appears nowhere in the HTML',
    HTML.toLowerCase().includes(CODE.toLowerCase()) === false);
  check('a SHA-256 digest is what it compares against',
    /[0-9a-f]{64}/.test(HTML) && HTML.includes('SHA-256'));
  check('and the digest is the right one',
    HTML.includes(Buffer.from(
      new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(CODE)))
    ).toString('hex')));
  // A comment has to say what this gate is and is not.
  check('a comment says it is a light gate, not security',
    /light gate/i.test(HTML) && /not security/i.test(HTML));
}

console.log('\n/cohort26 — remembered for the tab, not past it');
{
  const first = load();
  await settle();
  await first.enter(CODE);
  const kept = first.stored();
  check('the digest is what is stored, never the code',
    typeof kept === 'string' && kept.length === 64 && !kept.toLowerCase().includes(CODE.toLowerCase()));

  // A refresh, with what the first visit left behind.
  const again = load({ access: kept });
  await settle();
  check('a refresh does not ask again',
    again.gate().hidden === true && again.shell().hidden === false);
  check('...and it fetches the data straight away', again.net.calls.length === 1);

  const stale = load({ access: 'not-the-digest' });
  await settle();
  check('a stale value does not open it', stale.shell().hidden === true);
}

console.log('\n/cohort26 — storage and crypto that are not there');
{
  const page = load({ storage: 'blocked' });
  await settle();
  check('blocked storage still shows the gate', page.gate().hidden === false);
  await page.enter(CODE);
  check('...and the code still opens it', page.shell().hidden === false);

  const insecure = load({ crypto: 'missing' });
  await settle();
  await insecure.enter(CODE);
  check('without crypto.subtle it says why, not "wrong code"',
    /https/i.test(insecure.msg()) && insecure.msg() !== "That code isn't right.", insecure.msg());
}

console.log('\n/cohort26 — every slot is filled from data.json');
{
  const page = load();
  await settle();
  await page.enter(CODE);

  for (const id of TABS) {
    await page.tab(id);
    const slots = page.slots(id);
    check(id + ': the panel is open and has slots',
      page.document.getElementById(id).hidden === false && slots.length > 0);
    check(id + ': every chart, table and list is filled',
      slots.every((s) => s.childElementCount > 0),
      slots.filter((s) => !s.childElementCount).map((s) => s.id || s.className));
    check(id + ': nothing failed to load',
      page.document.getElementById(id).querySelector('.cx-fail') === null);
  }

  // Back to the first tab, and check the numbers against the file.
  await page.tab('stages');
  const text = (sel) => page.document.querySelector(sel).textContent;
  check('the Members tile is the count in data.json',
    text('.cx-tiles .cx-tile:nth-child(1) .n') === String(kpi('members')),
    text('.cx-tiles .cx-tile:nth-child(1) .n'));
  check('the level 1-or-2 tile too',
    text('.cx-tiles .cx-tile:nth-child(2) .n') === String(kpi('l12')));
  check('and the take above them is bound, not typed',
    text('#stages .cx-take').startsWith(String(kpi('l12')) + ' of ' + String(kpi('members'))),
    text('#stages .cx-take').slice(0, 40));

  check('the ladder has a bar per funnel row',
    page.document.querySelectorAll('#ch-funnel svg > g').length === rowsOf('funnel').length);
  check('every AI level has a stage card',
    page.document.querySelectorAll('#st-detail .cx-stage').length === rowsOf('stage_detail').length);
  check('the heat map has a cell per level and revenue stage',
    page.document.querySelectorAll('#ch-heat .cx-heat div[data-members]').length ===
      5 * rowsOf('revenue').length);
  check('the level chart has a bar per level',
    page.document.querySelectorAll('#ch-levels svg > g').length === rowsOf('levels').length);

  await page.tab('agents');
  const agentThemes = rowsOf('themes').filter((r) => r.topic === 'Agents');
  check('agents: a stacked bar per theme in the data',
    page.document.querySelectorAll('#ch-agents svg > g').length === agentThemes.length);
  check('agents: a detail row per theme too',
    page.document.querySelectorAll('#th-agents .cx-theme').length === agentThemes.length);
  check('agents: the biggest theme leads, with its own count',
    page.document.querySelector('#th-agents .cx-theme .cnt').textContent.startsWith(
      String(Math.max(...agentThemes.map((t) => t.members)))));
  check('agents: the level legend is drawn',
    page.document.querySelectorAll('#card-agents-themes .lv-legend span').length === 4);
  check('agents: a bar per thing they want taken off them',
    page.document.querySelectorAll('#ch-auto svg > g').length === rowsOf('automation').length);

  await page.tab('outcomes');
  check('outcomes: a list item per success theme',
    page.document.querySelectorAll('#ls-success li').length === rowsOf('success').length);
  check('outcomes: a list item per pain theme',
    page.document.querySelectorAll('#ls-pains li').length === rowsOf('pains').length);

  // Bars are coloured by class, not by a fill attribute: var() inside an SVG
  // presentation attribute is not resolved everywhere, and a theme switch has
  // to recolour them without a redraw.
  await page.tab('stages');
  const bars = [...page.document.querySelectorAll('#ch-funnel svg rect:not(.hit)')];
  check('every bar is coloured by a class',
    bars.length === rowsOf('funnel').length && bars.every((r) => /^cx-f[1-4]$/.test(r.getAttribute('class'))),
    bars.map((r) => r.getAttribute('class')));
  check('no fill attribute carries a CSS variable',
    [...page.document.querySelectorAll('[fill]')].every((n) => !/var\(/.test(n.getAttribute('fill'))));

  // No number is written into the markup, so every count on the page has to
  // have arrived from the file. The placeholder is the em dash.
  check('the bound slots are em dashes in the file, not numbers',
    [...HTML.matchAll(/data-field="[^"]*">([^<]*)</g)].every((m) => m[1] === '—'));
}

console.log('\n/cohort26 — a dead fetch says so instead of lying');
{
  for (const mode of ['error', 'throw']) {
    const page = load({ network: mode });
    await settle();
    await page.enter(CODE);
    check(mode + ': the charts say they failed',
      page.document.querySelectorAll('#stages .cx-fail').length > 0);
    check(mode + ': and no count is invented',
      page.document.querySelector('.cx-tiles .cx-tile:nth-child(1) .n').textContent === '—');
  }
}

console.log('\n/cohort26 — nothing forces the page to scroll sideways');
{
  const page = load();
  await settle();
  await page.enter(CODE);

  // The page's own CSS. Any fixed width in here wider than a small phone
  // would push the page out past the viewport.
  const css = [...page.document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
  // Declarations only: a breakpoint inside @media (min-width: 640px) is a
  // condition, not a width the layout has to honour.
  const declarations = css.replace(/@media[^{]*\{/g, '{');
  const fixed = [...declarations.matchAll(/(?<!max-)(?<!-)\b(min-width|width)\s*:\s*(\d+)px/g)]
    .filter((m) => Number(m[2]) > 360);
  check('no fixed width over 360px in the page CSS', fixed.length === 0, fixed.map((m) => m[0]));
  check('the page itself is capped with max-width, not width', /\.cx\s*\{[^}]*max-width:\s*1200px/.test(css));

  // The heat map is the one grid wider than 375px. It gets its minimum width
  // in the script, inside a wrapper that takes the scroll itself.
  const grid = page.document.querySelector('#ch-heat .cx-heat');
  const scroller = grid.parentElement;
  check('the heat map carries a minimum width', /\d+px/.test(grid.style.minWidth), grid.style.minWidth);
  check('...inside a wrapper, not loose in the card', scroller.classList.contains('cx-scroll'));
  check('...and that wrapper is what scrolls', /overflow-x:\s*auto/.test(css));
  check('the tab strip scrolls rather than the page',
    /\.cx-tabs\s*\{[^}]*overflow-x:\s*auto/.test(css));

  // A card that cannot shrink below its content is the other way a grid
  // pushes a page wide.
  check('cards are allowed to shrink', /\.cx-card\s*\{[^}]*min-width:\s*0/.test(css));
  check('the grids size from the smaller of 100% and a column',
    (css.match(/minmax\(min\(100%,/g) || []).length >= 3);
  check('no element carries an inline fixed width',
    page.document.querySelectorAll('[style*="width:"]').length === 1, // the heat grid alone
    [...page.document.querySelectorAll('[style*="width:"]')].map((n) => n.className));

  // Charts are drawn to fit, not to a fixed size.
  const svg = page.document.querySelector('#ch-funnel svg');
  check('charts are drawn at 100% width with a viewBox',
    svg.getAttribute('width') === '100%' && /^0 0 \d+ \d+$/.test(svg.getAttribute('viewBox')));
}

console.log('\n/cohort26 — the page itself');
{
  check('it is kept out of search results', /<meta name="robots" content="noindex"\s*\/?>/.test(HTML));
  check('the title is the one asked for', /<title>Superhuman Cohort 26 \| Time Rich<\/title>/.test(HTML));
  check('the share image is the Time Rich one',
    HTML.includes('<meta property="og:image" content="https://timerich.ai/og-time-rich.png"/>'));
  check('it uses the portal stylesheet, so both themes follow',
    HTML.includes('href="../club/portal.css"') && HTML.includes('portal-theme.js'));
  check('it pulls no third-party script', /src="https?:/.test(HTML) === false);

  const page = load();
  await settle();
  check('the theme is set before first paint', page.document.documentElement.hasAttribute('data-theme'));
  check('there is a theme control on the page',
    page.document.querySelector('[data-theme-select]') !== null);

  await page.enter(CODE);
  check('the seven tabs are Ella\'s, in her order',
    [...page.document.querySelectorAll('.cx-tab')].map((t) => t.dataset.page).join() === TABS.join(),
    [...page.document.querySelectorAll('.cx-tab')].map((t) => t.dataset.page));
  check('the heading is hers, word for word',
    page.document.querySelector('.cx-head h1').textContent === 'Superhuman cohort: where everyone is');
  check('and so is the line under it',
    page.document.querySelector('.cx-head p').textContent ===
      'Anonymous view of the intake questionnaire. No names or companies. Counts are members unless a chart says questions.');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

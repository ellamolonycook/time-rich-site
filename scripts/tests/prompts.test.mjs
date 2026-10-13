// Prompt Library tests: the page, the renderer, and the two additions that
// shipped with it (the Resources FAQ and the In ChatGPT dropdown).
//
// The renderer is driven with a fake payload so the rule that matters can be
// checked directly: a card only grows a Download button when the member's
// payload actually contains that skill, which is the Worker's release-date
// and membership rule, not ours.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const EM_DASH = String.fromCharCode(8212);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const PROMPTS_JS = read('portal/portal-prompts.js');
const PROMPTS_HTML = read('portal/prompts.html');

// One unlocked week holding two of the sixteen packs, and one locked week
// holding a third. Only the two should become buttons.
const PAYLOAD = {
  ok: true,
  member: { first_name: 'Ada', role: 'buyer' },
  sessions: [],
  weeks: [
    { id: 0, title: 'Start here', unlocked: true, items: [
      { id: 11, kind: 'skill', title: 'Business COMPASS', url: 'compass-superhuman.zip' },
      { id: 12, kind: 'skill', title: 'Lock down my Claude', url: 'security-superhuman.zip' },
      { id: 13, kind: 'link', title: 'Workbook', url: 'https://example.com' },
    ] },
    { id: 1, title: 'Week 1', unlocked: false, items: [] },
    // A locked week comes back with no items at all, which is why the card
    // carries its own week number for the label.
    { id: 3, title: 'Week 3: Story and content', unlocked: false, items: [] },
  ],
};

async function openPrompts(payload = PAYLOAD) {
  const calls = [];
  const dom = new JSDOM(PROMPTS_HTML, {
    url: 'https://timerich.ai/portal/prompts.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      window.TR_PORTAL_CONFIG = {
        directoryUrl: 'https://worker.test/portal-directory',
        downloadUrl: 'https://worker.test/portal-download',
        sessionUrl: 'https://worker.test/portal-session',
        loginUrl: 'https://worker.test/portal-login',
        logoutUrl: 'https://worker.test/portal-logout',
      };
      window.localStorage.setItem('tr_portal_session',
        JSON.stringify({ token: 'tok-ABCDE', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
      window.fetch = (url, init = {}) => {
        url = String(url);
        calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
        if (url.includes('/portal-download')) {
          return Promise.resolve(new globalThis.Response(
            JSON.stringify({ url: 'https://sb.test/storage/v1/object/sign/portal-skills/x.zip?token=t' }), { status: 200 }));
        }
        if (url.includes('/portal-directory')) {
          return Promise.resolve(new globalThis.Response(JSON.stringify({ profiles: [] }), { status: 403 }));
        }
        return Promise.resolve(new globalThis.Response(JSON.stringify(payload), { status: 200 }));
      };
    },
  });
  dom.window.eval(read('portal/portal-live.js'));
  dom.window.eval(read('portal/portal-access.js'));
  dom.window.eval(PROMPTS_JS);
  dom.window.document.dispatchEvent(new dom.window.CustomEvent('trportal:data', { detail: payload }));
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  const doc = dom.window.document;
  return {
    dom, doc, calls,
    cards: () => [...doc.querySelectorAll('.trp-pcard')],
    cardByName: (name) => [...doc.querySelectorAll('.trp-pcard')]
      .find((c) => c.querySelector('.trp-pcard-name').textContent === name),
  };
}

console.log('\nPrompt Library — the cards');
{
  const page = await openPrompts();
  const cards = page.cards();
  check('sixteen cards', cards.length === 16, cards.length);
  check('every card has a name, a line and a phrase to say',
    cards.every((c) => c.querySelector('.trp-pcard-name')?.textContent.trim() &&
      c.querySelector('.trp-pcard-one')?.textContent.trim() &&
      c.querySelector('.trp-saybox-text')?.textContent.trim()));
  check('every card has a copy button for its phrase',
    cards.every((c) => c.querySelector('.trp-saybox .trp-copy')));

  const names = cards.map((c) => c.querySelector('.trp-pcard-name').textContent);
  check('no two cards share a name', new Set(names).size === names.length, names);
  check('the new context trigger is the one Ella set',
    page.cardByName('Build my context').querySelector('.trp-saybox-text').textContent ===
    'Superhuman: build my context');
  check('the security card is there with its own trigger',
    page.cardByName('Lock down my Claude').querySelector('.trp-saybox-text').textContent ===
    'Superhuman: lock down my Claude');
  check('the story bank card is there',
    Boolean(page.cardByName('Build my story bank')));
  check('Audit my AI is not a card', !names.includes('Audit my AI'), names);
}

console.log('\nPrompt Library — downloads follow the payload, not the page');
{
  const page = await openPrompts();
  const withButton = page.cards().filter((c) => c.querySelector('.trp-pcard-get'));
  check('only the packs in an unlocked week get a Download button',
    withButton.length === 2 &&
    withButton.map((c) => c.querySelector('.trp-pcard-name').textContent).sort().join('|') ===
      'Build my context|Lock down my Claude',
    withButton.map((c) => c.querySelector('.trp-pcard-name').textContent));

  check('a card whose week has not opened has no button',
    !page.cardByName('Write a post').querySelector('.trp-pcard-get'));

  // the same gated call the Resources page makes
  page.cardByName('Build my context').querySelector('.trp-pcard-get').click();
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  const dl = page.calls.find((c) => c.url.includes('/portal-download'));
  check('the button posts the item id and the session token to the Worker',
    Boolean(dl) && dl.body.item_id === 11 && dl.body.token === 'tok-ABCDE', dl && dl.body);
  check('no public link to a pack anywhere on the page',
    !/drive\.google\.com|\/downloads\//.test(PROMPTS_JS + PROMPTS_HTML));

  const locked = await openPrompts({
    ...PAYLOAD,
    weeks: [{ id: 0, title: 'Start here', unlocked: false, items: [
      { id: 11, kind: 'skill', title: 'Business COMPASS', url: 'compass-superhuman.zip' }] }],
  });
  check('a locked week gives no buttons at all',
    locked.cards().length === 16 && locked.cards().every((c) => !c.querySelector('.trp-pcard-get')));
}

console.log('\nPrompt Library — a pack whose week has not opened');
{
  const page = await openPrompts();
  const label = (name) => page.cardByName(name).querySelector('.trp-pcard-locked');

  check('a week 3 card says when it unlocks',
    label('Write a post')?.textContent === 'Download unlocks Week 3', label('Write a post')?.textContent);
  check('all thirteen week 3 cards say it',
    page.cards().filter((c) => c.querySelector('.trp-pcard-locked')?.textContent === 'Download unlocks Week 3').length === 13,
    page.cards().filter((c) => c.querySelector('.trp-pcard-locked')).length);
  check('a card that already has its pack says nothing about unlocking',
    !label('Build my context') && !label('Lock down my Claude'));
  check('the pack that has not been built yet says so, rather than nothing',
    label('Audit my LinkedIn')?.textContent === 'Download coming soon',
    label('Audit my LinkedIn')?.textContent);
  check('and it reads properly out loud',
    /download is coming soon/i.test(label('Audit my LinkedIn').getAttribute('aria-label')),
    label('Audit my LinkedIn').getAttribute('aria-label'));
  check('same style and same slot as the unlock label, so cards keep their shape',
    label('Audit my LinkedIn').tagName === 'SPAN' &&
    label('Audit my LinkedIn').className === label('Write a post').className &&
    label('Audit my LinkedIn').parentElement.className ===
      label('Write a post').parentElement.className,
    label('Audit my LinkedIn').className);
  check('it is never a button, because there is nothing to download yet',
    !page.cardByName('Audit my LinkedIn').querySelector('.trp-pcard-get'));
  check('the label is not a button, because there is nothing to press',
    label('Write a post').tagName === 'SPAN');
  check('the label reads properly out loud',
    /download unlocks in week 3/i.test(label('Write a post').getAttribute('aria-label')),
    label('Write a post').getAttribute('aria-label'));
  check('the label says it is the download that is locked, not the phrase',
    /^Download unlocks/.test(label('Write a post').textContent));
  check('a locked card can still be copied from',
    page.cards().every((c) => Boolean(c.querySelector('.trp-saybox .trp-copy'))) &&
    page.cards().every((c) => !c.querySelector('.trp-saybox .trp-copy').disabled));

  // A week the member does not have at all is not something to claim a date for.
  const noWeek3 = await openPrompts({
    ...PAYLOAD,
    weeks: PAYLOAD.weeks.filter((w) => w.id !== 3),
  });
  check('no unlock date is claimed for a week that is not in the payload',
    noWeek3.cards().every((c) => {
      const l = c.querySelector('.trp-pcard-locked');
      return !l || l.textContent === 'Download coming soon';
    }),
    noWeek3.cards().map((c) => c.querySelector('.trp-pcard-locked')?.textContent).filter(Boolean).slice(0, 3));

  // And once week 3 opens, the label gives way to the button.
  const open3 = await openPrompts({
    ...PAYLOAD,
    weeks: PAYLOAD.weeks.map((w) => w.id === 3
      ? { ...w, unlocked: true, items: [{ id: 40, kind: 'skill', title: 'Write a post', url: 'linkedin-post-writer.zip' }] }
      : w),
  });
  const writer = open3.cardByName('Write a post');
  check('when the week opens the label becomes a download',
    Boolean(writer.querySelector('.trp-pcard-get')) && !writer.querySelector('.trp-pcard-locked'));
}

console.log('\nPrompt Library — autopilot briefs');
{
  const page = await openPrompts();
  const withAuto = page.cards().filter((c) => c.querySelector('.trp-pcard-auto'));
  check('seven cards carry an autopilot brief', withAuto.length === 7, withAuto.length);

  const LIVE_LINKEDIN = ['Audit my LinkedIn', 'Optimise my profile', 'Break down a hook',
    'Comment on a post', 'Clear my comments', 'Find my warm threads', 'Who engaged',
    'Get the team posting'];
  check('nothing that needs a live LinkedIn page has one',
    LIVE_LINKEDIN.every((n) => !page.cardByName(n).querySelector('.trp-pcard-auto')),
    LIVE_LINKEDIN.filter((n) => page.cardByName(n).querySelector('.trp-pcard-auto')));
  check('locking down your AI has none either',
    !page.cardByName('Lock down my Claude').querySelector('.trp-pcard-auto'));

  const briefs = withAuto.map((c) => c.querySelector('.trp-copybox-text').textContent);
  check('every brief has all six lines, in order',
    briefs.every((b) => /^Job: .+\nReads: .+\nDoes: .+\nDelivers: .+\nNever: .+\nRuns: .+$/s.test(b)),
    briefs[0]);
  check('every brief drafts and never sends',
    briefs.every((b) => /Never: send, post or publish anything\. Draft only/.test(b)));
  check('every brief delivers into the Notion workbook',
    briefs.every((b) => /Notion workbook/.test(b.split('\n').find((l) => l.startsWith('Delivers:')))),
    briefs.map((b) => b.split('\n').find((l) => l.startsWith('Delivers:'))).filter((l) => !/Notion workbook/.test(l)));
  check('each brief is closed until it is opened',
    withAuto.every((c) => !c.querySelector('.trp-pcard-auto').open));
}

console.log('\nPrompt Library — when the payload never arrives');
{
  // The Worker answering slowly is not this page's fault. Sitting on
  // "Loading the prompt library" forever with no reason given is.
  check('the card area is a target the shared gate can write a reason into',
    /id="prompt-cards" data-portal-message/.test(PROMPTS_HTML));
  check('the gate looks for that target when a page has no weeks or sessions hook',
    /\[data-portal-message\]/.test(read('portal/portal-access.js')));

  // Drive it: this is what a hung or refused Worker looks like to the page.
  const dom = new JSDOM(PROMPTS_HTML, {
    url: 'https://timerich.ai/portal/prompts.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      window.TR_PORTAL_CONFIG = { directoryUrl: 'https://worker.test/portal-directory',
        downloadUrl: 'https://worker.test/portal-download',
        sessionUrl: 'https://worker.test/portal-session',
        loginUrl: 'https://worker.test/portal-login',
        logoutUrl: 'https://worker.test/portal-logout' };
      window.localStorage.setItem('tr_portal_session',
        JSON.stringify({ token: 'tok-ABCDE', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
      window.fetch = () => Promise.reject(new Error('network'));
    },
  });
  dom.window.eval(read('portal/portal-live.js'));
  dom.window.eval(read('portal/portal-access.js'));
  dom.window.eval(PROMPTS_JS);
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));

  const area = dom.window.document.getElementById('prompt-cards');
  check('the loading line is replaced by a reason',
    !/Loading the prompt library/.test(area.textContent) && area.textContent.trim().length > 0,
    area.textContent.trim().slice(0, 60));
  check('and the reason is the portal-wide wording, not a new one',
    area.textContent.includes(dom.window.TRPortal.messages.unavailable), area.textContent.trim());
}

console.log('\nPrompt Library — the page and the nav');
{
  check('the page is titled for the portal', /<title>Prompts \| Time Rich Portal<\/title>/.test(PROMPTS_HTML));
  check('no em dashes in the page copy', !PROMPTS_HTML.includes(EM_DASH) && !PROMPTS_JS.includes(EM_DASH));
  check('no prompt tells a member to start from their COMPASS',
    !/Start from my Business COMPASS/.test(PROMPTS_JS));
  check('the guides section stays hidden until a guide has a link',
    /data-prompt-guides hidden/.test(PROMPTS_HTML) && !/http[^']*notion[^']*'\s*}/.test(PROMPTS_JS));

  for (const name of ['dashboard', 'curriculum', 'sessions', 'resources', 'members', 'prompts']) {
    const html = read('portal/' + name + '.html');
    const links = [...html.matchAll(/<a href="prompts\.html"([^>]*)>/g)].map((m) => m[1]);
    check(name + '.html: a Prompts link in the top nav and the phone menu',
      links.length === 2, links.length);
    const current = links.filter((a) => /aria-current="page"/.test(a)).length;
    check(name + '.html: marked as the current page only on prompts.html',
      current === (name === 'prompts' ? 2 : 0), current);
  }
  check('prompts.html does not still think it is Resources',
    !/href="resources\.html" aria-current/.test(PROMPTS_HTML));

  // Tailwind purges any class it cannot find in a content file, so the new
  // renderer has to be in the content globs or the cards lose their styling.
  const cfg = read('tailwind.config.js');
  check('the Tailwind content globs cover the new renderer',
    /'\.\/portal\/\*\.js'/.test(cfg), cfg.split('content:')[1]?.slice(0, 120));
  const css = read('portal/portal.css');
  for (const cls of ['trp-pcards', 'trp-pcard-head', 'trp-saybox', 'trp-pcard-get']) {
    check('the built stylesheet still has .' + cls, css.includes(cls));
  }
}

console.log('\nResources — the FAQ');
{
  const html = read('portal/resources.html');
  const dom = new JSDOM(html, { virtualConsole: new VirtualConsole() });
  const faq = dom.window.document.querySelector('.trp-faq');
  check('there is an FAQ section', Boolean(faq));
  const qs = [...faq.querySelectorAll('details')].map((d) => d.querySelector('.trp-acc-title').textContent);
  check('four questions: ChatGPT, missed sessions, recordings, help',
    qs.length === 4 && /ChatGPT/.test(qs[0]) && /miss a session/.test(qs[1]) &&
    /recordings/i.test(qs[2]) && /help/i.test(qs[3]), qs);
  check('the ChatGPT answer is the one Ella wrote, word for word',
    faq.textContent.includes('Yes for prompts and your Notion context. Skills and scheduled agents run in Claude, which is what the sessions teach.'));
  check('every question is closed by default', [...faq.querySelectorAll('details')].every((d) => !d.hasAttribute('open')));
  check('no em dashes in the FAQ', !faq.textContent.includes(EM_DASH));
}

console.log('\nDashboard — the In ChatGPT dropdown');
{
  const html = read('portal/dashboard.html');
  const dom = new JSDOM(html, { virtualConsole: new VirtualConsole() });
  const accs = [...dom.window.document.querySelectorAll('.trp-connect details')];
  const titles = accs.map((d) => d.querySelector('.trp-acc-title').textContent);
  check('three dropdowns now: Claude, Grok Bot, ChatGPT',
    titles.join('|') === 'In Claude|In Grok Bot|In ChatGPT', titles);

  const gpt = accs[2];
  const steps = [...gpt.querySelectorAll('.trp-acc-steps li')].map((li) => li.textContent.trim());
  check('five steps', steps.length === 5, steps.length);
  check('the steps use the current ChatGPT menu names',
    /Settings/.test(steps[0]) && /Apps & connectors/.test(steps[0]) &&
    /Connect/.test(steps[1]) && /Sync/.test(steps[3]) && /Project settings/.test(steps[4]), steps);
  check('it says connectors need a paid plan, and skills still run in Claude',
    /paid ChatGPT plan/.test(gpt.textContent) && /still run in Claude/.test(gpt.textContent));

  const fig = gpt.querySelector('[data-shot]');
  check('the screenshot is hidden until the file is added', fig.hasAttribute('hidden'));
  check('a hidden figure never requests a missing image',
    fig.hasAttribute('hidden') && /loading="lazy"/.test(fig.innerHTML));
  check('it still hides itself if the file goes missing later',
    /onerror="this\.closest\('\[data-shot\]'\)\.hidden = true"/.test(fig.innerHTML));
  check('all three dropdowns are closed by default', accs.every((d) => !d.hasAttribute('open')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

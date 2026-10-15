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

// The seven headings the brief sets, in the order it sets them.
const HEADINGS = ['ROLE', 'SECOND OPINION', 'CONTEXT', 'TASK', 'RED TEAM', 'BLIND SPOTS', 'OUTPUT'];
const headingsOf = (text) =>
  text.split('\n').map((line) => line.trim()).filter((line) => HEADINGS.includes(line));

// Every pack a card points at, read off the renderer so the list cannot
// drift from the cards themselves.
const CARD_FILES = [...PROMPTS_JS.matchAll(/^\s*file: '([^']+)'/gm)].map((m) => m[1]);
const PROMPTS_HTML = read('portal/prompts.html');
const SKILL_TEXT_JS = read('portal/skill-instructions.js');

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

// Week 3 open, holding two packs that are in downloads/ and so have
// instructions to send. Week 0's two packs are open in every payload but
// have no pack in the repo, which is its own test below.
const OPEN_PAYLOAD = {
  ...PAYLOAD,
  weeks: PAYLOAD.weeks.map((w) => w.id === 3
    ? { ...w, unlocked: true, items: [
        { id: 40, kind: 'skill', title: 'Write a post', url: 'linkedin-post-writer.zip' },
        { id: 41, kind: 'skill', title: 'Break down a hook', url: 'linkedin-hook-extractor.zip' }] }
    : w),
};

async function openPrompts(payload = PAYLOAD, withSkillText = true) {
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
  // The page loads this before the renderer, so the test does too: without
  // it a card has no instructions to hand an AI and grows no AI buttons.
  if (withSkillText) dom.window.eval(SKILL_TEXT_JS);
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
  for (const cls of ['trp-ai-row', 'trp-ai', 'trp-toast', 'trp-ptemplate']) {
    check('the built stylesheet has the new .' + cls, css.includes(cls));
  }
  // The unlock label is 171px and will not wrap, which used to set the grid
  // track's minimum and push the whole page sideways on a 320px screen.
  check('the unlock label is allowed to wrap on the narrowest screens',
    /@media\s*\(max-width:\s*359px\)/.test(css) &&
    /\.trp-pcard-locked\{[^}]*white-space:normal/.test(css.replace(/\s*([{:;])\s*/g, '$1')),
    css.includes('359px'));
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

console.log('\nPrompt Library — the prompt template card');
{
  const page = await openPrompts();
  const card = page.doc.querySelector('.trp-ptemplate');
  check('there is a template card', Boolean(card));
  check('it is the first thing in the library, above the cards',
    page.doc.getElementById('prompt-cards').firstElementChild === card);
  check('it is titled the way Ella named it',
    card.querySelector('.trp-pcard-name').textContent === 'The prompt template');
  check('and carries the one-line intro, word for word',
    card.querySelector('.trp-pcard-one').textContent ===
    'Use this shape for any prompt. The second opinion and blind spots are where the value is.',
    card.querySelector('.trp-pcard-one').textContent);

  const text = card.querySelector('.trp-copybox-text').textContent;
  check('the shape is blank, ready to fill in', /\[expert type\]/.test(text) && /\[your offer\]|\[One sentence/.test(text));
  check('it has all seven headings, in order',
    headingsOf(text).join('|') === HEADINGS.join('|'), headingsOf(text).join('|'));
  check('it has a Copy button', Boolean(card.querySelector('.trp-copy')));
  check('and the three AI buttons', card.querySelectorAll('.trp-ai').length === 3);
  check('it is not counted as one of the sixteen skill cards',
    !card.classList.contains('trp-pcard') && page.cards().length === 16);
}

console.log('\nPrompt Library — open in your AI');
{
  const page = await openPrompts(OPEN_PAYLOAD);
  const AI = { claude: 'https://claude.ai/new', chatgpt: 'https://chatgpt.com/', grok: 'https://grok.com/' };

  const withAi = page.cards().filter((c) => c.querySelector('.trp-ai'));
  check('a card whose pack the member has gets the three buttons',
    withAi.length === 3 &&
    withAi.map((c) => c.querySelector('.trp-pcard-name').textContent).sort().join('|') ===
      'Break down a hook|Build my context|Write a post',
    withAi.map((c) => c.querySelector('.trp-pcard-name').textContent));

  const links = withAi[0].querySelectorAll('.trp-ai');
  check('they are Claude, ChatGPT and Grok, in that order',
    [...links].map((a) => a.textContent).join('|') === 'Open in Claude|Open in ChatGPT|Open in Grok');
  check('each opens a new tab and cannot reach back into this one',
    [...links].every((a) => a.target === '_blank' && /\bnoopener\b/.test(a.rel)));
  check('each names the skill and the AI out loud',
    [...links].every((a) => /^Open the .+ skill in (Claude|ChatGPT|Grok)$/.test(a.getAttribute('aria-label'))),
    [...links].map((a) => a.getAttribute('aria-label')));
  check('they are the outline pill, not a new filled button',
    [...links].every((a) => a.className === 'trp-ai'));

  // The phrase alone does nothing in an AI that has not installed the pack,
  // so what travels is the pack's own instructions and then the phrase.
  const writer = page.cardByName('Write a post');
  const sent = page.dom.window.TRSkillText['linkedin-post-writer.zip'].trim() + '\n\nwrite a post';
  check('what a skill button sends is the instructions, then the Say-this line',
    sent.startsWith('---\nname: linkedin-post-writer') && sent.endsWith('\n\nwrite a post'));
  check('and the Say-this box is untouched by any of it',
    writer.querySelector('.trp-saybox-text').textContent === 'write a post' &&
    Boolean(writer.querySelector('.trp-saybox .trp-copy')));

  // Every pack is far past the ceiling, so all of them take the fallback.
  check('a skill is too long to carry in a URL, so it falls back to a blank chat',
    [...writer.querySelectorAll('.trp-ai')].every((a) => a.href === AI[/Claude/.test(a.textContent) ? 'claude' : /ChatGPT/.test(a.textContent) ? 'chatgpt' : 'grok']),
    [...writer.querySelectorAll('.trp-ai')].map((a) => a.href));
  check('and not one of them carries half a skill',
    [...writer.querySelectorAll('.trp-ai')].every((a) => !a.href.includes('?q=')));
  check('no href on the page runs past the 6000 character ceiling',
    [...page.doc.querySelectorAll('.trp-ai')].every((a) => a.href.length <= 6000),
    Math.max(...[...page.doc.querySelectorAll('.trp-ai')].map((a) => a.href.length)));

  // The template is short, so it goes the other way and arrives prefilled.
  const tmpl = [...page.doc.querySelectorAll('.trp-ptemplate .trp-ai')];
  const shape = page.doc.querySelector('.trp-ptemplate .trp-copybox-text').textContent;
  check('the template is short enough to arrive already in the chat',
    tmpl[0].href === 'https://claude.ai/new?q=' + encodeURIComponent(shape));
  check('and arrives whole, not truncated',
    decodeURIComponent(tmpl[0].href.split('?q=')[1]) === shape);
  check('line breaks and brackets survive the encoding',
    tmpl[0].href.includes('%0A') && tmpl[0].href.includes('%5Bexpert%20type%5D'));
  check('a curly apostrophe survives as UTF-8',
    tmpl[2].href.includes('%E2%80%99') && shape.includes(String.fromCharCode(8217)));
  check('each AI gets its own query parameter',
    tmpl[1].href.startsWith('https://chatgpt.com/?q=') && tmpl[2].href.startsWith('https://grok.com/?q='));
}

console.log('\nPrompt Library — a locked card stays locked');
{
  const page = await openPrompts();
  const locked = page.cards().filter((c) => c.querySelector('.trp-pcard-locked'));
  check('no card with an unlock label has AI buttons',
    locked.every((c) => !c.querySelector('.trp-ai')),
    locked.filter((c) => c.querySelector('.trp-ai')).map((c) => c.querySelector('.trp-pcard-name').textContent));
  check('the buttons cannot be used to walk around the week a pack opens in',
    !page.cardByName('Write a post').querySelector('.trp-ai'));

  const everythingLocked = await openPrompts({
    ...PAYLOAD,
    weeks: [{ id: 0, title: 'Start here', unlocked: false, items: [] }],
  });
  check('a member with nothing open sees no AI buttons on any card',
    everythingLocked.cards().every((c) => !c.querySelector('.trp-ai')));
  check('but the template card is theirs either way',
    everythingLocked.doc.querySelectorAll('.trp-ptemplate .trp-ai').length === 3);
}

console.log('\nPrompt Library — a pack with no instructions to send');
{
  // security-superhuman is unlocked for everyone but is not in downloads/,
  // so there is nothing to hand an AI. A trigger phrase on its own would
  // quietly do nothing, so the card shows no buttons at all rather than a
  // button that fails silently.
  const page = await openPrompts();
  const security = page.cardByName('Lock down my Claude');
  check('Lock down my Claude: has its download but no AI buttons, because no pack to read',
    Boolean(security.querySelector('.trp-pcard-get')) && !security.querySelector('.trp-ai'));
  // Its neighbour in week 0 does have one now, which is what tells the two
  // cases apart: the gate is the pack, not the week.
  check('Build my context, whose pack is in downloads/, does get them',
    page.cardByName('Build my context').querySelectorAll('.trp-ai').length === 3);
  check('the generated file is the only place that text comes from',
    /TRSkillText/.test(PROMPTS_JS) && !/ROLE\\nYou are a world-class/.test(PROMPTS_JS));
  check('and the page loads it before the renderer that reads it',
    PROMPTS_HTML.indexOf('skill-instructions.js') < PROMPTS_HTML.indexOf('portal-prompts.js'));

  // Without it loaded at all, the page still works: it just has no buttons.
  const bare = await openPrompts(OPEN_PAYLOAD, false);
  check('a missing instructions file costs the buttons, never the page',
    bare.cards().length === 16 &&
    bare.cards().every((c) => !c.querySelector('.trp-ai')) &&
    bare.cards().every((c) => c.querySelector('.trp-saybox-text').textContent.trim()));
}

console.log('\nPrompt Library — the generated instructions');
{
  const page = await openPrompts();
  const text = page.dom.window.TRSkillText;
  const files = Object.keys(text);
  check('every pack in downloads/ is in it', files.length === 16, files.length);
  check('each entry is the pack\u2019s own SKILL.md',
    files.every((f) => /^---\nname: /.test(text[f])), files.filter((f) => !/^---\nname: /.test(text[f])));
  check('fourteen of the sixteen cards can be opened in an AI',
    CARD_FILES.filter((f) => text[f]).length === 14,
    CARD_FILES.filter((f) => !text[f]));
  check('and the two that cannot are the packs that are not in downloads/',
    CARD_FILES.filter((f) => !text[f]).sort().join(', ') ===
      'audit-linkedin-for-icp-goal.zip, security-superhuman.zip',
    CARD_FILES.filter((f) => !text[f]));
  check('the file says not to edit it by hand',
    /GENERATED FILE/.test(SKILL_TEXT_JS) && /build-skill-instructions\.mjs/.test(SKILL_TEXT_JS));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

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
  check('every card has a name and a line',
    cards.length === 16 &&
    cards.every((c) => c.querySelector('.trp-pcard-name')?.textContent.trim() &&
      c.querySelector('.trp-pcard-one')?.textContent.trim()));
  check('every card has a copy button for its prompt',
    cards.every((c) => c.querySelector('.trp-actions .trp-copy')));

  // The trigger phrase is gone. "Superhuman: build my context" does nothing
  // in an AI that has no pack installed, and nobody installs one now, so it
  // was an instruction on every card that quietly did not work.
  check('no card carries an "Or say" trigger line',
    cards.every((c) => !c.querySelector('.trp-pcard-say') &&
      !c.querySelector('.trp-pcard-say-text') && !c.querySelector('.trp-saybox')));
  check('and the words are not on the page in any other shape',
    !/\bOr say\b/i.test(page.doc.body.textContent) &&
    !/Superhuman: /.test(page.doc.body.textContent),
    (page.doc.body.textContent.match(/.{0,30}(Or say|Superhuman: ).{0,30}/i) || [])[0]);

  const names = cards.map((c) => c.querySelector('.trp-pcard-name').textContent);
  check('no two cards share a name', new Set(names).size === names.length, names);
  check('the context card is there, under the name Ella set',
    Boolean(page.cardByName('Build my context')));
  check('and the security card, under its new name',
    Boolean(page.cardByName('Lock down my AI')) && !names.includes('Lock down my Claude'),
    names);
  check('the story bank card is there',
    Boolean(page.cardByName('Build my story bank')));
  check('Audit my AI is not a card', !names.includes('Audit my AI'), names);
}

console.log('\nPrompt Library — nothing to install, nothing to download');
{
  // The page used to hand out skill packs: a Download button once the week
  // opened, an "unlocks Week 3" label until then, and AI buttons only on the
  // cards whose pack the member already had. All of it assumed the member
  // knew what installing a skill meant. None of it is here any more.
  const page = await openPrompts();

  check('no card has a download button',
    page.cards().every((c) => !c.querySelector('.trp-pcard-get')),
    page.cards().filter((c) => c.querySelector('.trp-pcard-get')).length);
  check('no card has an unlock or coming-soon download label',
    page.cards().every((c) => !c.querySelector('.trp-pcard-locked')));
  check('the page never posts to the download route',
    !page.calls.some((c) => c.url.includes('/portal-download')),
    page.calls.map((c) => c.url));

  // Said out loud as well as in the markup: a member should not meet the
  // word "install" or "download" on this page at all.
  const shown = page.doc.body.textContent.replace(/\s+/g, ' ');
  check('the word install never appears on the page', !/install/i.test(shown),
    (shown.match(/.{0,40}install.{0,40}/i) || [])[0]);
  check('the word download never appears either', !/download/i.test(shown),
    (shown.match(/.{0,40}download.{0,40}/i) || [])[0]);
  check('and no aria-label says it behind the scenes',
    [...page.doc.querySelectorAll('[aria-label]')]
      .every((n) => !/install|download/i.test(n.getAttribute('aria-label'))),
    [...page.doc.querySelectorAll('[aria-label]')]
      .map((n) => n.getAttribute('aria-label')).filter((l) => /install|download/i.test(l)));
  check('no public link to a pack anywhere on the page',
    !/drive\.google\.com|\/downloads\//.test(PROMPTS_JS + PROMPTS_HTML));

  // The payload used to decide which cards worked. Now it decides nothing.
  const locked = await openPrompts({
    ...PAYLOAD,
    weeks: [{ id: 0, title: 'Start here', unlocked: false, items: [] }],
  });
  check('a member with every week locked still gets all sixteen cards',
    locked.cards().length === 16, locked.cards().length);
  check('and every one of them still opens in an AI',
    locked.cards().every((c) => c.querySelectorAll('.trp-open').length === 1),
    locked.cards().filter((c) => c.querySelectorAll('.trp-open').length !== 1)
      .map((c) => c.querySelector('.trp-pcard-name').textContent));
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

  // The redesign takes Prompts out of the menu. The page is still built and
  // still served — every link to it from inside the Resources page and from
  // the curriculum still works — it is simply no longer one of the four
  // places the menu steers to. So what is pinned here is the opposite of
  // what used to be: no portal page offers it in either menu.
  for (const name of ['club', 'dashboard', 'curriculum', 'sessions', 'resources', 'members', 'prompts']) {
    const html = read('portal/' + name + '.html');
    const menus = html.slice(html.indexOf('<div id="mobile-menu"'), html.indexOf('</header>'));
    const links = [...menus.matchAll(/<a href="prompts\.html"([^>]*)>/g)].map((m) => m[1]);
    check(name + '.html: no Prompts link in the top nav or the phone menu',
      links.length === 0, links.length);
  }
  // It is the Accelerator that is lit while a member is on it: the menu's
  // Accelerator entry points at the dashboard, so it carries the generic
  // "current item in this set" rather than claiming to be this page.
  check('prompts.html lights the Accelerator, without claiming to be it',
    /<a href="dashboard\.html"[^>]*aria-current="true"/.test(PROMPTS_HTML) &&
    !/aria-current="page"/.test(PROMPTS_HTML));
  check('prompts.html does not still think it is Resources',
    !/href="resources\.html" aria-current/.test(PROMPTS_HTML));

  // Tailwind purges any class it cannot find in a content file, so the new
  // renderer has to be in the content globs or the cards lose their styling.
  const cfg = read('tailwind.config.js');
  check('the Tailwind content globs cover the new renderer',
    /'\.\/portal\/\*\.js'/.test(cfg), cfg.split('content:')[1]?.slice(0, 120));
  const css = read('portal/portal.css');
  for (const cls of ['trp-pcards', 'trp-pcard-head', 'trp-toast', 'trp-ptemplate']) {
    check('the built stylesheet still has .' + cls, css.includes(cls));
  }
  for (const cls of ['trp-picker', 'trp-picker-opt', 'trp-open', 'trp-actions',
                     'trp-group-title', 'trp-pcard-more']) {
    check('the built stylesheet has the new .' + cls, css.includes(cls));
  }
  // The three pills, the bordered phrase panel and the trigger line itself
  // have no markup left.
  for (const cls of ['trp-ai-row', 'trp-saybox', 'trp-pcard-say']) {
    check('the stylesheet no longer carries the dead .' + cls, !css.includes(cls));
  }
  // The download button and its unlock label are gone from this page, so
  // their rules should have gone with them rather than sitting in the
  // stylesheet forever waiting for markup that never comes back.
  for (const cls of ['trp-pcard-get', 'trp-pcard-locked']) {
    check('the stylesheet no longer carries the dead .' + cls, !css.includes(cls));
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

console.log('\nPrompt Library — choose your AI once');
{
  const page = await openPrompts();
  const picker = page.doc.querySelector('.trp-picker');

  check('the picker is on the page, above the cards', Boolean(picker) &&
    picker.compareDocumentPosition(page.doc.querySelector('.trp-pcard')) === 4);
  check('it is labelled for what it does',
    picker.querySelector('.trp-picker-label').textContent === 'Open prompts in');
  check('it offers Claude, ChatGPT and Grok, in that order',
    [...picker.querySelectorAll('.trp-picker-opt')].map((b) => b.textContent).join('|')
      === 'Claude|ChatGPT|Grok');
  check('it is a radio group, so the keyboard and a screen reader understand it',
    picker.querySelector('[role="radiogroup"]') &&
    [...picker.querySelectorAll('.trp-picker-opt')].every((b) => b.getAttribute('role') === 'radio'));
  check('Claude is the one chosen to begin with',
    [...picker.querySelectorAll('.trp-picker-opt')]
      .map((b) => b.getAttribute('aria-checked')).join('|') === 'true|false|false');

  // One button per card, not three. That is the whole point of the picker.
  check('every card carries exactly one open button',
    page.cards().every((c) => c.querySelectorAll('.trp-open').length === 1),
    page.cards().filter((c) => c.querySelectorAll('.trp-open').length !== 1).length);
  check('so the page has sixteen of them, not forty-eight',
    page.doc.querySelectorAll('.trp-pcard .trp-open').length === 16,
    page.doc.querySelectorAll('.trp-pcard .trp-open').length);
  check('and they all say where they open',
    page.cards().every((c) => c.querySelector('.trp-open').textContent === 'Open in Claude'));

  // Pressing another option moves every button on the page at once.
  picker.querySelectorAll('.trp-picker-opt')[1].click();
  check('choosing ChatGPT repoints all sixteen',
    page.cards().every((c) => c.querySelector('.trp-open').textContent === 'Open in ChatGPT' &&
      c.querySelector('.trp-open').href.startsWith('https://chatgpt.com/?q=')),
    page.cards().filter((c) => !c.querySelector('.trp-open').href.startsWith('https://chatgpt.com/?q=')).length);
  check('and the choice moves with it in the control',
    [...picker.querySelectorAll('.trp-picker-opt')]
      .map((b) => b.getAttribute('aria-checked')).join('|') === 'false|true|false');
  check('the prompt still rides along after the switch',
    decodeURIComponent(page.cardByName('Write a post').querySelector('.trp-open').href.split('?q=')[1])
      .startsWith('You are a ghostwriter'));
  check('the choice is remembered for next time',
    page.dom.window.localStorage.getItem('tr_prompt_ai') === 'chatgpt',
    page.dom.window.localStorage.getItem('tr_prompt_ai'));

  picker.querySelectorAll('.trp-picker-opt')[2].click();
  check('and again for Grok',
    page.cards().every((c) => c.querySelector('.trp-open').href.startsWith('https://grok.com/?q=')));
}

console.log('\nPrompt Library — what the open button hands over');
{
  const page = await openPrompts();

  const links = [...page.doc.querySelectorAll('.trp-pcard .trp-open')];
  check('every one carries its prompt in the URL',
    links.length === 16 && links.every((a) => a.href.includes('?q=')),
    links.filter((a) => !a.href.includes('?q=')).length);
  check('not one falls back to a blank chat',
    links.every((a) => a.href !== 'https://claude.ai/new'));
  check('and none runs past the 6000 character ceiling',
    links.every((a) => a.href.length <= 6000), Math.max(...links.map((a) => a.href.length)));

  const writer = page.cardByName('Write a post');
  const sent = decodeURIComponent(writer.querySelector('.trp-open').href.split('?q=')[1]);
  check('the prompt arrives whole',
    sent.endsWith('Never invent a number, client or result.'), sent.slice(-50));
  check('it is a prompt, not a trigger phrase',
    sent.startsWith('You are a ghostwriter') && sent !== 'write a post');
  check('it stands on its own, with nothing installed and no pack named',
    !/skill|install|download|\.zip/i.test(sent));
  check('line breaks survive the encoding', writer.querySelector('.trp-open').href.includes('%0A'));
  check('each opens a new tab and cannot reach back into this one',
    links.every((a) => a.target === '_blank' && /\bnoopener\b/.test(a.rel)));
  check('each names the prompt and the AI out loud',
    links.every((a) => /^Open the .+ prompt in Claude$/.test(a.getAttribute('aria-label'))),
    links.map((a) => a.getAttribute('aria-label')).slice(0, 2));

  const texts = links.map((a) => a.href.split('?q=')[1]);
  check('no two cards send the same prompt', new Set(texts).size === 16, new Set(texts).size);

  check('every card can also just hand over the text',
    page.cards().every((c) => c.querySelector('.trp-actions .trp-copy')));
  check('and none of them offers a trigger phrase instead',
    page.cards().length === 16 &&
    page.cards().every((c) => !c.querySelector('.trp-pcard-say-text') &&
      !c.querySelector('.trp-saybox')));
}

console.log('\nPrompt Library — the prompts themselves');
{
  const page = await openPrompts();
  const prompts = page.cards().map((c) => ({
    name: c.querySelector('.trp-pcard-name').textContent,
    text: decodeURIComponent(c.querySelector('.trp-open').href.split('?q=')[1]),
  }));

  check('all sixteen are written', prompts.length === 16 && prompts.every((p) => p.text.length > 150));
  check('each one opens by saying what the AI is',
    prompts.every((p) => /^You are /.test(p.text)), prompts.filter((p) => !/^You are /.test(p.text)).map((p) => p.name));

  const BANNED = /game-?changing|transformative|empower|ecosystem|leverage|unlock|journey|foster|navigate|cutting-edge|innovative|seamless|robust|holistic/i;
  check('no long dashes in any prompt',
    prompts.every((p) => !/[–—]/.test(p.text)),
    prompts.filter((p) => /[–—]/.test(p.text)).map((p) => p.name));
  check('no banned words',
    prompts.every((p) => !BANNED.test(p.text)),
    prompts.filter((p) => BANNED.test(p.text)).map((p) => p.name + ': ' + p.text.match(BANNED)[0]));
  check('no "thing" standing in for a real noun',
    prompts.every((p) => !/\bthings?\b/i.test(p.text)),
    prompts.filter((p) => /\bthings?\b/i.test(p.text)).map((p) => p.name));

  check('the context prompt builds the COMPASS',
    /Business COMPASS/.test(prompts.find((p) => p.name === 'Build my context').text));
  check('the security prompt covers the settings before connecting anything',
    /before I connect/.test(prompts.find((p) => p.name === 'Lock down my AI').text));
  check('the audit prompt asks for the goal and the buyer first',
    /90 day goal/.test(prompts.find((p) => p.name === 'Audit my LinkedIn').text));
}

console.log('\nPrompt Library — two groups, not a wall of sixteen');
{
  const page = await openPrompts();
  const heads = [...page.doc.querySelectorAll('.trp-group-title')];
  check('the cards are split under two headings',
    heads.map((h) => h.textContent).join('|') === 'Set up your AI|LinkedIn',
    heads.map((h) => h.textContent));
  check('each heading has a line saying what the group is for',
    [...page.doc.querySelectorAll('.trp-group-lede')].every((p) => p.textContent.trim().length > 10));

  const lists = [...page.doc.querySelectorAll('.trp-pcards')];
  check('three cards in the setup group and thirteen in LinkedIn',
    lists.map((ul) => ul.children.length).join('|') === '3|13',
    lists.map((ul) => ul.children.length));
  check('the setup group is the three that give the others context',
    [...lists[0].children].map((li) => li.querySelector('.trp-pcard-name').textContent).join('|')
      === 'Build my context|Lock down my AI|Build my story bank');
  check('and every card lands in exactly one group',
    lists.reduce((n, ul) => n + ul.children.length, 0) === 16);

  // A week item in the Curriculum links straight to a run of cards, so the
  // heading has to carry the id that link points at.
  const heads2 = [...page.doc.querySelectorAll('.trp-group-head')];
  check('each group heading carries an anchor to link to',
    heads2.map((h) => h.id).join('|') === 'set-up-your-ai|linkedin',
    heads2.map((h) => h.id));
  check('the setup anchor is on the heading above the setup cards',
    page.doc.getElementById('set-up-your-ai').nextElementSibling.classList.contains('trp-pcards') &&
    page.doc.getElementById('set-up-your-ai').nextElementSibling.children.length === 3);
}

console.log('\nPrompt Library — one fold per card');
{
  const page = await openPrompts();
  const more = (name) => page.cardByName(name).querySelector('.trp-pcard-more');

  check('a card folds its extras into one disclosure, not two',
    page.cards().every((c) => c.querySelectorAll('details').length <= 1),
    page.cards().filter((c) => c.querySelectorAll('details').length > 1).length);
  check('it is folded away, so the button stays the point',
    page.cards().every((c) => !c.querySelector('details') || !c.querySelector('details').open));
  check('it is titled for what is inside, with no mention of installing',
    more('Write a post').querySelector('.trp-acc-title').textContent === 'More ways to use this');

  check('fifteen cards carry the long version',
    page.cards().filter((c) => /THE FULL VERSION|The full version/i
      .test(c.querySelector('.trp-pcard-more')?.textContent || '')).length === 15,
    page.cards().filter((c) => /the full version/i.test(c.querySelector('.trp-pcard-more')?.textContent || '')).length);
  check('seven carry an autopilot brief',
    page.cards().filter((c) => /put it on autopilot/i
      .test(c.querySelector('.trp-pcard-more')?.textContent || '')).length === 7,
    page.cards().filter((c) => /put it on autopilot/i.test(c.querySelector('.trp-pcard-more')?.textContent || '')).length);
  check('the one pack that was never built still has its prompt and button',
    page.cardByName('Audit my LinkedIn').querySelectorAll('.trp-open').length === 1 &&
    page.cardByName('Audit my LinkedIn').querySelector('.trp-open').href.includes('?q='));

  // Without the generated instructions the folds thin out, nothing else does.
  const bare = await openPrompts(PAYLOAD, false);
  check('a missing instructions file costs the long version, never the prompts',
    bare.cards().length === 16 &&
    bare.cards().every((c) => c.querySelectorAll('.trp-open').length === 1));
}

console.log('\nPrompt Library — write your own, at the foot');
{
  const page = await openPrompts();
  const tmpl = page.doc.querySelector('.trp-ptemplate');

  check('the template is a fold, not a wall of monospace on arrival',
    tmpl.tagName === 'DETAILS' && !tmpl.open);
  check('it is titled for the job it does',
    tmpl.querySelector('.trp-pcard-name').textContent === 'Write your own prompt');
  check('it sits below the cards now, not above them',
    page.doc.querySelector('.trp-pcard').compareDocumentPosition(tmpl) === 4);
  check('it still carries the shape and a way to take it',
    tmpl.querySelector('.trp-copybox-text').textContent.includes('ROLE') &&
    Boolean(tmpl.querySelector('.trp-copy')));
  check('and it opens in an AI like everything else',
    tmpl.querySelector('.trp-open').href.startsWith('https://claude.ai/new?q='));
  check('its brackets are deliberate and survive the encoding',
    tmpl.querySelector('.trp-open').href.includes('%5Bexpert%20type%5D'));

  // Folded at the foot is only safe if there is a way to it from the top.
  const link = page.doc.querySelector('.trp-own-link');
  check('a link beside the page title points at it',
    Boolean(link) && link.getAttribute('href') === '#write-your-own' && tmpl.id === 'write-your-own');
  check('it sits in the page head, not in the library',
    Boolean(link.closest('.trp-page-head')));
  check('and the title still comes first in the markup, for a screen reader',
    page.doc.querySelector('.trp-title').compareDocumentPosition(link) === 4);
  check('following it opens the fold rather than dropping you on a closed one',
    (link.click(), tmpl.open === true));
}

console.log('\nPrompt Library — the generated instructions');
{
  const page = await openPrompts();
  const text = page.dom.window.TRSkillText;
  const files = Object.keys(text);
  check('every pack in downloads/ is in it', files.length === 17, files.length);
  check('each entry is the pack\u2019s own SKILL.md',
    files.every((f) => /^---\nname: /.test(text[f])), files.filter((f) => !/^---\nname: /.test(text[f])));
  check('fifteen of the sixteen cards have a long version to offer',
    CARD_FILES.filter((f) => text[f]).length === 15,
    CARD_FILES.filter((f) => !text[f]));
  check('and the only one without is the pack that was never built',
    CARD_FILES.filter((f) => !text[f]).join(', ') === 'audit-linkedin-for-icp-goal.zip',
    CARD_FILES.filter((f) => !text[f]));
  check('the file says not to edit it by hand',
    /GENERATED FILE/.test(SKILL_TEXT_JS) && /build-skill-instructions\.mjs/.test(SKILL_TEXT_JS));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

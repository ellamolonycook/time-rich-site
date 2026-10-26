/* "Which personal AI agent should you start with?" — one source, two pages.
 *
 * The comparison is on the Resources page and in Week 1 of the Curriculum.
 * It used to be markup, which would have meant two copies of six rows of
 * sentences and a date label; the first time Ella changed one of them they
 * would have drifted. So the rows live here, once, and each page carries an
 * empty <div data-agents-block> for this file to fill.
 *
 * Everything goes in through createElement and textContent. Nothing here is
 * member data, but the rule in this portal is that no file builds markup
 * from a string, and a shared file is the last place to make an exception.
 *
 * Classes come from .trp-agents in portal-tailwind-src.css, which is what
 * turns the table into one card per agent under 900px. The only rule this
 * file needs of its own is .trp-agent-link, in portal-content.css.
 *
 * No date label. The one it carried named the day it was last looked at,
 * which ages in public and says nothing a member can act on.
 */
(function () {
  'use strict';

  var HEADING = 'Which personal AI agent should you start with?';
  var INTRO = 'Personal agents now do real work for you: your inbox, your calendar, your bookings. ' +
    "They overlap a lot, so don't try them all. Pick the one that lives where your context already is, " +
    'give it one recurring task, and keep approval on.';

  var COLUMNS = ['Agent', 'Made by', 'Where it lives', 'Start with this task', 'Watch out for'];
  var WIDTHS = ['trp-ac-name', 'trp-ac-maker', 'trp-ac-where', 'trp-ac-task', 'trp-ac-watch'];

  /* Each agent's name links to where you sign up, in a new tab. Hark has no
     url: there is no confirmed link for it, and a guess in a members' resource
     is worse than a name on its own. */
  var AGENTS = [
    {
      name: 'Dots',
      url: 'https://chatgpt.com',
      maker: 'OpenAI',
      where: 'Inside ChatGPT (set up on desktop)',
      task: 'Email drafts, using the ChatGPT context you already have',
      watch: 'Needs ChatGPT Pro ($100/month). Not yet open to Pro users in the UK or EU.'
    },
    {
      name: 'Muse',
      url: 'https://www.meta.ai',
      maker: 'Meta',
      where: 'App, web, WhatsApp and Mac',
      task: 'Turning your saved Instagram posts into a list you can use',
      watch: 'US and Canada only. Trains on your chats unless you switch it off. Turn on approval for every action.'
    },
    {
      name: 'Grok Bot',
      url: 'https://grok.com',
      maker: 'xAI',
      where: 'Named "Bots" in the Grok app, linked to Gmail, Calendar, Drive and Slack',
      task: 'A daily brief Bot (we set this up in the Accelerator)',
      watch: 'Paid plan needed. All your Bots share one cloud computer, so logins are not kept apart.'
    },
    {
      name: 'Instinct',
      url: 'https://app.instinct.com/invite?t=uwtiwya74qy2r7ntq3mdmzrrxu&preview=imessage',
      maker: 'Instinct',
      where: 'iMessage, WhatsApp and phone calls',
      task: 'A morning brief sent by text',
      watch: 'Invite-only beta. Has sent an email without approval before.'
    },
    {
      name: 'Town',
      url: 'https://www.town.com',
      maker: 'Town',
      where: 'Its own @town.com email, plus Gmail, Outlook, Slack, WhatsApp and a Mac app',
      task: 'A daily inbox triage and a weekly briefing',
      watch: 'Paid plans use credits, so set a spend cap. Keep the approval queue on.'
    },
    {
      name: 'Hark',
      url: '',
      maker: 'Hark Labs',
      where: 'Its own app, where you can watch each task as it runs',
      task: 'Travel and browser admin you want to watch it do',
      watch: 'Newer and less proven. Check pricing before you rely on it.'
    }
  ];

  /* Ella's three rules, in her words. The lead of each one is bold: they
     are an instruction, and the sentence after it is the reason. */
  var RULES = [
    ['Connect your tools first.', 'Give your agent your email, calendar and LinkedIn, so it works from what you already know, not a blank page.'],
    ['Delegate a growth task first.', 'Start with one task that brings in money every week, like follow-ups or a morning lead brief, and count how much you have to correct.'],
    ['Keep approval on.', 'Anything that sends a message, spends money or books something waits for your yes.']
  ];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* https only: the urls above are ours, and this is what stops a bad edit
     becoming a javascript: link in a members' page. An empty url is checked
     first, because new URL('', here) resolves to the page itself -- which
     would have given Hark a link to the page it is already on. */
  function safe(url) {
    if (typeof url !== 'string' || !url) return '';
    try {
      var u = new URL(url, window.location.href);
      return u.protocol === 'https:' ? url : '';
    } catch (e) { return ''; }
  }

  function nameCell(agent) {
    var th = el('th', 'trp-agent-name');
    th.setAttribute('role', 'rowheader');
    th.setAttribute('scope', 'row');
    var href = safe(agent.url);
    if (!href) { th.appendChild(document.createTextNode(agent.name)); return th; }
    var a = el('a', 'trp-agent-link', agent.name);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', agent.name + ' (opens in a new tab)');
    th.appendChild(a);
    return th;
  }

  function table() {
    var wrap = el('div', 'trp-agents-wrap');
    var t = el('table', 'trp-agents');
    t.setAttribute('role', 'table');

    var group = document.createElement('colgroup');
    WIDTHS.forEach(function (cls) { group.appendChild(el('col', cls)); });
    t.appendChild(group);

    var thead = document.createElement('thead');
    thead.setAttribute('role', 'rowgroup');
    var head = document.createElement('tr');
    head.setAttribute('role', 'row');
    COLUMNS.forEach(function (label) {
      var th = el('th', '', label);
      th.setAttribute('role', 'columnheader');
      th.setAttribute('scope', 'col');
      head.appendChild(th);
    });
    thead.appendChild(head);
    t.appendChild(thead);

    var tbody = document.createElement('tbody');
    tbody.setAttribute('role', 'rowgroup');
    AGENTS.forEach(function (agent) {
      var row = document.createElement('tr');
      row.setAttribute('role', 'row');
      row.appendChild(nameCell(agent));
      // The cell's own data-label is what the 900px card layout draws as its
      // heading, so the five column names are still written down once.
      [['Made by', agent.maker], ['Where it lives', agent.where],
       ['Start with this task', agent.task], ['Watch out for', agent.watch]]
        .forEach(function (pair) {
          var td = el('td', '', pair[1]);
          td.setAttribute('role', 'cell');
          td.setAttribute('data-label', pair[0]);
          row.appendChild(td);
        });
      tbody.appendChild(row);
    });
    t.appendChild(tbody);

    wrap.appendChild(t);
    return wrap;
  }

  /* The three rules, in the numbering the install steps on Resources use.
     One sentence each, so there is no title line above the body. */
  function rules() {
    var frag = document.createDocumentFragment();
    frag.appendChild(el('p', 'trp-tag mt-8', 'Three rules'));
    var ol = el('ol', 'trp-steps mt-4');
    RULES.forEach(function (text, i) {
      var li = document.createElement('li');
      var n = el('span', 'trp-step', i < 9 ? '0' + (i + 1) : String(i + 1));
      n.setAttribute('aria-hidden', 'true');
      li.appendChild(n);
      var body = el('p', 'trp-step-body');
      body.appendChild(el('b', '', text[0]));
      body.appendChild(document.createTextNode(' ' + text[1]));
      li.appendChild(body);
      ol.appendChild(li);
    });
    frag.appendChild(ol);
    return frag;
  }

  function mount() {
    var slots = document.querySelectorAll('[data-agents-block]');
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.getAttribute('data-agents-done') === 'true') continue;
      var id = 'agents-heading-' + (i + 1);

      // The page owns the box; this owns what is in it. The heading is here
      // too, so the two pages cannot end up calling it different things.
      var heading = el('h2', 'trp-section-title', HEADING);
      heading.id = id;
      slot.setAttribute('aria-labelledby', id);
      slot.appendChild(heading);
      slot.appendChild(el('p', 'trp-lede', INTRO));
      slot.appendChild(table());
      slot.appendChild(rules());
      slot.setAttribute('data-agents-done', 'true');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  // Read by the tests, and by anything that wants the rows without the table.
  window.TRAgents = { AGENTS: AGENTS, COLUMNS: COLUMNS, HEADING: HEADING, INTRO: INTRO, RULES: RULES, mount: mount };
})();

/* =====================================================================
 * Time Rich portal - Prompt Library renderer.
 *
 * One card per job: the name, one line on what it does, a short prompt that
 * opens straight in an AI, and an autopilot brief where a schedule can
 * really run from email, calendar, Notion or call notes.
 *
 * Nothing on this page asks anyone to install or download a skill. Every
 * card hands over a prompt that works on its own in a blank chat, so there
 * is no pack to fetch, no week to wait for and nothing to gate.
 *
 * createElement + textContent only. Nothing from the payload is ever put
 * through innerHTML.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var L = window.TRLive;
  if (!L) return;

  /* ---- the cards -------------------------------------------------------
     `file` is the pack name this card came from. Nothing is downloaded any
     more, so it is only a key: it is what PROMPTS and TRSkillText are keyed
     by, and what the open-in-AI event is filed under.

     `auto` is present only where a scheduled run has something real to read.
     A skill that needs a live LinkedIn page has no autopilot. */
  var CARDS = [
    {
      file: 'compass-superhuman.zip',
      group: 'setup',
      name: 'Build my context',
      one: 'Builds your Business COMPASS from your own calls, docs, email and Notion, then shows where your time goes.',
      auto: {
        job: 'Keep my Business COMPASS current.',
        reads: 'My Business COMPASS, my last two weeks of call notes, and my email.',
        does: 'Finds anything in recent calls or email that contradicts or adds to the COMPASS.',
        delivers: 'A draft update in my Notion workbook, section by section, with the source for each change.',
        runs: 'Sunday, 6pm.'
      }
    },
    {
      file: 'security-superhuman.zip',
      group: 'setup',
      name: 'Lock down my AI',
      one: 'Walks you through three privacy settings in your AI before you connect anything, and reports back what changed.'
    },
    {
      file: 'story-superhuman.zip',
      group: 'setup',
      name: 'Build my story bank',
      one: 'Pulls the stories you already tell out of your own transcripts and banks them in one place.',
      auto: {
        job: 'Add any new story I told this week to my story bank.',
        reads: 'My content guardrails and this week’s call notes.',
        does: 'Finds stories I have not banked yet and writes them up in the Story Bank format.',
        delivers: 'Draft entries in the Story Bank page of my Notion workbook.',
        runs: 'Sunday, 7pm.'
      }
    },
    {
      file: 'audit-linkedin-for-icp-goal.zip',
      group: 'linkedin',
      name: 'Audit my LinkedIn',
      one: 'Scores your LinkedIn profile against one 90 day goal and one ideal client, then gives you ranked fixes with drafts.'
    },
    {
      file: 'linkedin-profile-optimizer.zip',
      group: 'linkedin',
      name: 'Optimise my profile',
      one: 'Rewrites your whole LinkedIn profile, from the headline to the recommendations.'
    },
    {
      file: 'linkedin-content-planner.zip',
      group: 'linkedin',
      name: 'Plan my week',
      one: 'Builds a seven day LinkedIn plan with a pillar, a format and a hook for each day.',
      auto: {
        job: 'Plan next week on LinkedIn.',
        reads: 'My Business COMPASS, my pillars and my content plan in Notion.',
        does: 'Builds the seven day plan and balances the pillars.',
        delivers: 'A draft plan in the Content Hub page of my Notion workbook.',
        runs: 'Sunday, 4pm.'
      }
    },
    {
      file: 'linkedin-post-writer.zip',
      group: 'linkedin',
      name: 'Write a post',
      one: 'Writes a LinkedIn post from scratch using a proven hook, then takes the AI tells out of it.',
      auto: {
        job: 'Draft tomorrow’s post from my plan.',
        reads: 'My content plan, my story bank and my content guardrails in Notion.',
        does: 'Writes the post for tomorrow’s slot and runs the humaniser pass over it.',
        delivers: 'A draft in the Content Hub page of my Notion workbook.',
        runs: 'Weekdays, 6am.'
      }
    },
    {
      file: 'linkedin-hook-extractor.zip',
      group: 'linkedin',
      name: 'Break down a hook',
      one: 'Takes a post that worked and tells you which hook formula it used, and why.'
    },
    {
      file: 'linkedin-humanizer.zip',
      group: 'linkedin',
      name: 'Humanise a draft',
      one: 'Takes the AI tells out of a draft, and audits a post before you publish it.',
      auto: {
        job: 'Audit every draft waiting in my Content Hub.',
        reads: 'My voice profile and my drafts in Notion.',
        does: 'Scores each draft and rewrites the lines that read as AI.',
        delivers: 'Draft rewrites in my Notion workbook, next to the original.',
        runs: 'Weekdays, 5am.'
      }
    },
    {
      file: 'linkedin-repurposer.zip',
      group: 'linkedin',
      name: 'Repurpose something',
      one: 'Rebuilds a tweet, video, blog or newsletter as a native LinkedIn post.',
      auto: {
        job: 'Repurpose my newest long piece.',
        reads: 'My Content Library and my content guardrails in Notion.',
        does: 'Finds the newest piece I have not repurposed and rebuilds it for LinkedIn.',
        delivers: 'A draft in the Content Hub page of my Notion workbook.',
        runs: 'Wednesday, 7am.'
      }
    },
    {
      file: 'linkedin-interviewer.zip',
      group: 'linkedin',
      name: 'Interview me',
      one: 'Interviews you for the raw material your posts are made of.',
      auto: {
        job: 'Ask me one interview question.',
        reads: 'My Business COMPASS and my story bank in Notion.',
        does: 'Finds the thinnest part of my story bank and writes one question for it.',
        delivers: 'A draft question in my Notion workbook, for me to answer in my own time.',
        runs: 'Tuesday, 8am.'
      }
    },
    {
      file: 'linkedin-comment-drafter.zip',
      group: 'linkedin',
      name: 'Comment on a post',
      one: 'Drafts a comment on someone else’s post, in your voice.'
    },
    {
      file: 'linkedin-reply-handler.zip',
      group: 'linkedin',
      name: 'Clear my comments',
      one: 'Drafts a reply to one comment, or sweeps a whole post and replies to every comment worth answering.'
    },
    {
      file: 'linkedin-thread-monitor.zip',
      group: 'linkedin',
      name: 'Find my warm threads',
      one: 'Tracks which of your comments got a reply, and flags the ones worth following up now.'
    },
    {
      file: 'linkedin-engager-analytics.zip',
      group: 'linkedin',
      name: 'Who engaged',
      one: 'Pulls everyone who liked or commented on a post and sorts them by how well they fit your ideal client.'
    },
    {
      file: 'linkedin-employee-advocacy.zip',
      group: 'linkedin',
      name: 'Get the team posting',
      one: 'Sets up and runs a LinkedIn program for your team, from the launch plan to the numbers.'
    }
  ];

  /* Six reads in the member workbook. A guide with no url is left out, so
     the row stays empty until the links are in. */
  var GUIDES = [
    { title: 'Build an Agent That Knows You', url: '' },
    { title: 'Brief Claude Like Your Best Hire', url: '' },
    { title: '12 Jobs to Hand Your Agents', url: '' },
    { title: 'The Monthly AI Reset', url: '' },
    { title: 'Five Business Dashboards Hiding in Your Inbox', url: '' },
    { title: 'Keep Claude Honest', url: '' }
  ];

  /* ---- copy to clipboard ------------------------------------------------ */

  function copyButton(getText, label) {
    var btn = L.el('button', 'trp-copy', 'Copy');
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    var timer = null;

    function say(word) {
      btn.textContent = word;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
    }

    btn.addEventListener('click', function () {
      var text = getText();
      if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
        window.navigator.clipboard.writeText(text).then(
          function () { say('Copied'); },
          function () { say('Press Ctrl+C'); }
        );
        return;
      }
      say('Press Ctrl+C');
    });
    return btn;
  }

  /* ---- the prompt template ----------------------------------------------
     The shape every prompt on this page is written in. It sits at the top of
     the library as a card of its own, so a member can take the shape away and
     use it on work that has no skill behind it. */

  var TEMPLATE_INTRO =
    'Use this shape for any prompt. The second opinion and blind spots are where the value is.';

  var TEMPLATE = [
    'ROLE',
    'You are a world-class [expert type] with 20 years doing [specific job] for [type of business].',
    '',
    'SECOND OPINION',
    'Also answer as [opposing expert] who disagrees on [the main tension]. Show both views side by side. Do not blend them.',
    '',
    'CONTEXT',
    'Read my Business COMPASS in Notion first. Extra facts: [numbers, audience, deadline, links].',
    '',
    'TASK',
    '[One sentence: what I need, for whom, by when.]',
    '',
    'RED TEAM',
    'Before answering, list the 3 biggest ways this fails or wastes money.',
    '',
    'BLIND SPOTS',
    'End with 2 things I didn’t ask but should have.',
    '',
    'OUTPUT',
    'Max 7 bullets. Plain words. No flattery. If a fact is missing, write [Needs input]. Never guess.'
  ].join('\n');

  /* ---- the prompt each card hands over -----------------------------------
     One short prompt per card, keyed the same way the cards are. Each one is
     self-contained: it assumes nothing is installed, nothing has been read
     beforehand, and that the member may be starting from a blank chat. That
     is what lets every button prefill rather than send a trigger phrase that
     only works inside a pack.

     Short on purpose. The whole text rides in the query string, so it has to
     stay well under MAX_URL once encoded. The full pack instructions are
     still one click away on the card, for anyone who wants them. */

  var PROMPTS = {
    'compass-superhuman.zip': [
      'You are a chief of staff who builds a founder context document out of primary sources.',
      '',
      'Build my Business COMPASS: what I sell, who I serve, my frameworks, my stories and proof, my beliefs and my voice.',
      '',
      'Ask me first for my three best sales calls or talks, my website or LinkedIn, and any document that already describes the business. Wait for me, then read what I give you.',
      'Pull only these: my one-liners, who I serve and who I turn away, my offers and prices, my named frameworks and their steps, the stories I repeat, proof with real numbers, and the phrases I use often.',
      'Every fact carries its source. Never invent a number, client, result or date. Write [Needs input] instead.',
      '',
      'Show me a one-screen summary first. Then ask me at most ten questions, most important first, one at a time.',
      'Finish by asking me for my one 90 day goal, a number and a date. Then name the one part of my business to hand to AI first, and why.'
    ].join('\n'),

    'security-superhuman.zip': [
      'You are a privacy-minded operator setting up a new AI account with me.',
      '',
      'Walk me through locking this account down before I connect my email, calendar or Notion. One setting at a time, and wait for me after each one.',
      '',
      'Cover three: whether my chats are used for training, how long they are kept, and which connectors already have access to my data.',
      'For each one tell me exactly where to click in this product today, what the safe setting is, and what I give up by choosing it.',
      '',
      'When I have done all three, report what is now on, what is off, and anything still open that I need to decide.',
      'If you cannot see a setting in this product, say so plainly rather than guessing at it.'
    ].join('\n'),

    'story-superhuman.zip': [
      'You are an editor who finds the stories a founder already tells and writes them down.',
      '',
      'Build my story bank. Ask me for two or three call recordings, talks or podcast transcripts, or let me paste them in. Wait for me.',
      '',
      'Find every moment I tell as a story: a decision, a near-miss, a client result, a mistake I made. Keep my own words for the lines that carry it.',
      'For each story write a working title, the one line that sets it up, what actually happened, the real number or outcome, and the point it proves.',
      'Never invent a detail. If a number is missing, write [Needs input].',
      '',
      'Give me the five strongest first, and say which part of my business each one sells.'
    ].join('\n'),

    'audit-linkedin-for-icp-goal.zip': [
      'You are a LinkedIn strategist auditing one profile against one goal and one buyer.',
      '',
      'Ask me two questions first and wait: what is my one 90 day goal, and who is the one client I want more of.',
      'Then I will paste my profile.',
      '',
      'Score it out of 10 on headline, about section, featured, experience, skills and recommendations.',
      'For each one say what it is costing me against that goal and that buyer, in plain words.',
      'Rank the fixes by what moves the goal fastest. Write the first three in full, ready to paste.',
      '',
      'No generic advice. Every point ties back to the goal or the buyer I gave you.'
    ].join('\n'),

    'linkedin-profile-optimizer.zip': [
      'You are a LinkedIn strategist rewriting a profile end to end.',
      '',
      'Ask me for my 90 day goal, the client I want more of, and my profile as it stands. Wait for all three.',
      '',
      'Rewrite the headline, the about section, my current role description, and the order of my featured section.',
      'The headline opens with what I do and for whom, never a job title.',
      'The about section opens with a number or a provocation, then one line on credentials, then what I am building and who it is for. Prose, no bullets. End on a human line.',
      '',
      'Give me two headlines and say which one you would ship and why.',
      'Use my own words wherever I gave you any. Never invent a credential or a result.'
    ].join('\n'),

    'linkedin-content-planner.zip': [
      'You are a content strategist planning one week of LinkedIn posts.',
      '',
      'Ask me for my 90 day goal, the client I want more of, and the three or four topics I want to be known for. Wait.',
      '',
      'Build seven days. For each day give me the topic, the format (story, how-to, opinion, case study or ask), the hook line, and the one point the post has to land.',
      'Balance the topics across the week. At most two posts that sell anything directly.',
      'Put the boldest ask on the day I am most likely to go through with it, and tell me which day that is and why.',
      '',
      'Output a table I can paste into Notion. No drafts yet, just the plan.'
    ].join('\n'),

    'linkedin-post-writer.zip': [
      'You are a ghostwriter who writes a LinkedIn post in my voice, not yours.',
      '',
      'Ask me for the topic, the one point the post has to land, and any real number, name or moment I want in it. Wait for my answer.',
      '',
      'Write the post. Open with a hook that earns the second line. Short paragraphs, one idea each. Specific beats general every time.',
      'End with one ask, written plainly, with a real chance of silence.',
      '',
      'Then show me the three lines most likely to read as machine-written, and rewrite each one.',
      'No long dashes. No lists of three pretending to be an argument. Never invent a number, client or result.'
    ].join('\n'),

    'linkedin-hook-extractor.zip': [
      'You are a copy analyst who takes hooks apart.',
      '',
      'I will paste a post that worked. Name the hook formula the first two lines use.',
      '',
      'Explain why it works on the reader: what it promises, what it holds back, and what makes them read line three.',
      'Fill the same formula in three times for my own business, ready to use.',
      'Say what would make this hook fall flat, and who it is wrong for.',
      '',
      'If the opening is weak and the post worked for another reason, say that instead of forcing a formula onto it.'
    ].join('\n'),

    'linkedin-humanizer.zip': [
      'You are an editor who takes the machine tells out of writing.',
      '',
      'I will paste a draft. Mark every line that reads as written by an AI and say why: long dashes used as joins, lists of three, empty intensifiers, hedging, or a tidy ending that says nothing.',
      '',
      'Rewrite each one in plain words, keeping my meaning and my specifics. Then give me the full rewritten post.',
      'Keep anything sharp or personal exactly as I wrote it. If a line is blunt, leave it blunt.',
      '',
      'Finish with the one line doing the most work, and the one I should cut.'
    ].join('\n'),

    'linkedin-repurposer.zip': [
      'You are an editor rebuilding one piece of content for LinkedIn.',
      '',
      'I will paste a tweet, a newsletter, a blog post or a video transcript. If the one point is not obvious, ask me for it and wait.',
      '',
      'Rebuild it as a native LinkedIn post. Not a summary, not a link drop. It has to stand on its own with nothing clicked.',
      'Keep my phrasing where it is good. Cut anything that only made sense in the original format.',
      '',
      'Give me the post, then one line on what you dropped and why.',
      'If the source is too thin to carry a post, say so and tell me what is missing.'
    ].join('\n'),

    'linkedin-interviewer.zip': [
      'You are an interviewer pulling raw material out of a founder.',
      '',
      'Ask me one question at a time and wait for my answer before the next one.',
      'Open with what I have been arguing about with people in my industry lately.',
      '',
      'Follow the specifics. When I give you a general answer, ask for the moment, the number or the name behind it. Up to three follow-ups before you move on.',
      'Ten questions in total. Do not summarise as you go.',
      '',
      'At the end, write my three strongest answers up as story notes in my own words, with the point each one proves, and say which is ready to post this week.'
    ].join('\n'),

    'linkedin-comment-drafter.zip': [
      'You are writing a LinkedIn comment in my voice.',
      '',
      'I will paste someone else’s post. If what I think about it is not obvious from what I send, ask me and wait.',
      '',
      'Write a comment that adds something the post did not say: a number, a counter-example, or where it breaks down in practice.',
      'Two to four sentences. No praise opener. Never restate their own point back at them.',
      '',
      'Give me three versions: one that agrees and extends, one that pushes back, and one that asks the question the post avoided.',
      'Never invent an experience I have not had.'
    ].join('\n'),

    'linkedin-reply-handler.zip': [
      'You are clearing a LinkedIn comment section with me.',
      '',
      'I will paste the post and its comments. Sort them into worth a real reply, worth a short thank you, and safe to leave.',
      '',
      'For everything in the first group, draft the reply in my voice. Answer the actual question, add one specific I left out of the post, and keep it under four sentences.',
      'Flag any comment that is a buying signal and say what moves it forward.',
      'Flag anything hostile, give me one calm reply, and tell me it is fine to leave it.',
      '',
      'Put the drafts in the order I should work through them.'
    ].join('\n'),

    'linkedin-thread-monitor.zip': [
      'You are tracking which of my LinkedIn conversations are actually going somewhere.',
      '',
      'I will paste the comments I have left over the last two weeks, with any replies.',
      '',
      'Sort them into three: they replied and it is still open, they replied and it closed, and no reply.',
      'For the open ones, rank by how close the person is to the client I want, and give me the next move for each: another comment, a connection note, or a direct message.',
      'Draft the next message for the top three, under four sentences each.',
      '',
      'Tell me which one I am most likely to put off, and why I should do that one first.'
    ].join('\n'),

    'linkedin-engager-analytics.zip': [
      'You are sorting the people who engaged with my post by how well they fit my buyer.',
      '',
      'Ask me who my ideal client is in one line, then wait. I will paste the people who liked or commented, with their headlines.',
      '',
      'Sort them into close fit, adjacent and worth knowing, and not a fit.',
      'For the close fits, say what in their headline makes them a fit, and whether they liked or commented, which tells me how warm they are.',
      'Draft a connection note for the top five. Under 300 characters, no pitch, and reference the post they engaged with.',
      '',
      'Never guess at someone’s role beyond what their headline says.'
    ].join('\n'),

    'linkedin-employee-advocacy.zip': [
      'You are getting a small team posting on LinkedIn.',
      '',
      'Ask me how many people are in it, what we sell, and what we want out of it in 90 days. Wait for all three.',
      '',
      'Give me who posts and how often, the three topics the team covers between them, and what each person owns based on what they actually do all day.',
      'Write the one-page brief I send them, in plain words, that says why this is worth their time personally and not only to the company.',
      'Draft a first post for each person in their own area, ready to edit.',
      '',
      'Then say what will make this fall apart by week three, and what to put in place now to stop it.'
    ].join('\n')
  };

  /* ---- open in your AI ---------------------------------------------------
     Three outline pills that hand the whole text to an AI in a new tab.

     Short enough to carry in the query string and the chat opens prefilled.
     Too long and the text goes to the clipboard instead and the AI opens on
     a blank chat, because a truncated prompt is worse than no prompt: the
     member would never know which half went missing.

     Each button is a real link, so the browser does the navigating. Nothing
     here calls window.open, which is what a popup blocker stops and what
     would break the moment the clipboard write went async before it. */

  var AIS = [
    { key: 'claude', name: 'Claude', home: 'https://claude.ai/new', q: 'https://claude.ai/new?q=' },
    { key: 'chatgpt', name: 'ChatGPT', home: 'https://chatgpt.com/', q: 'https://chatgpt.com/?q=' },
    { key: 'grok', name: 'Grok', home: 'https://grok.com/', q: 'https://grok.com/?q=' }
  ];

  /* Past this and the query string is dropped. Browsers and the AIs
     themselves differ on the real ceiling, so this is the brief's number and
     deliberately well under the lowest of them. */
  var MAX_URL = 6000;

  /* The site's event tracker: fires to GA4 (gtag) when it is there. */
  function track(name, params) {
    try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) { /* analytics never breaks a click */ }
  }

  // Where a button points, and whether the text rides along in the URL.
  function aiHref(ai, text) {
    var full = ai.q + window.encodeURIComponent(text);
    return full.length <= MAX_URL ? { href: full, prefilled: true } : { href: ai.home, prefilled: false };
  }

  /* One polite live region, reused. It is the only thing on this page that
     has to say something after the tab has already gone, so it is announced
     rather than drawn inside a card the member is no longer looking at. */
  var toastNode = null;
  var toastTimer = null;

  function toast(message) {
    if (!toastNode) {
      toastNode = L.el('div', 'trp-toast');
      toastNode.setAttribute('role', 'status');
      toastNode.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastNode);
    }
    toastNode.textContent = message;
    toastNode.setAttribute('data-show', '');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastNode.removeAttribute('data-show');
    }, 3600);
  }

  /* ---- which AI the page opens in ----------------------------------------
     Chosen once at the top and remembered on this device. Every card then
     carries one button instead of three, which is the difference between
     sixteen buttons on this page and forty-eight.

     The choice is a convenience, not data: if storage is blocked the picker
     still works for the visit and simply forgets afterwards. */

  var AI_KEY = 'tr_prompt_ai';
  var chosen = AIS[0];

  function readChoice() {
    try {
      var saved = window.localStorage.getItem(AI_KEY);
      for (var i = 0; i < AIS.length; i++) if (AIS[i].key === saved) return AIS[i];
    } catch (e) { /* private mode: the default stands */ }
    return AIS[0];
  }

  function writeChoice(ai) {
    try { window.localStorage.setItem(AI_KEY, ai.key); }
    catch (e) { /* the choice lasts the visit */ }
  }

  /* Everything that has to change when the choice changes, registered here so
     a card does not have to know the picker exists. */
  var followers = [];
  function onChoice(fn) { followers.push(fn); fn(chosen); }

  function picker(root) {
    L.clear(root);
    var wrap = L.el('div', 'trp-picker');
    wrap.appendChild(L.el('span', 'trp-tag trp-picker-label', 'Open prompts in'));

    var group = L.el('div', 'trp-picker-opts');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', 'Which AI your prompts open in');

    AIS.forEach(function (ai) {
      var b = L.el('button', 'trp-picker-opt', ai.name);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', ai.key === chosen.key ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (ai.key === chosen.key) return;
        chosen = ai;
        writeChoice(ai);
        track('prompt_ai_choice', { ai: ai.key });
        followers.forEach(function (fn) { fn(chosen); });
        [].forEach.call(group.children, function (other, i) {
          other.setAttribute('aria-checked', AIS[i].key === chosen.key ? 'true' : 'false');
        });
      });
      group.appendChild(b);
    });

    wrap.appendChild(group);
    root.appendChild(wrap);
  }

  /* ---- one open button, pointed wherever the picker says ------------------
     Still a real link, so the browser does the navigating and a popup blocker
     has nothing to stop. The href is rewritten in place when the choice
     changes rather than the row being rebuilt. */

  function openButton(getText, id, what) {
    var a = L.el('a', 'trp-open');
    a.target = '_blank';
    a.rel = 'noopener';

    onChoice(function (ai) {
      var to = aiHref(ai, getText());
      a.href = to.href;
      a.textContent = 'Open in ' + ai.name;
      a.setAttribute('aria-label', 'Open the ' + what + ' in ' + ai.name);
      a.setAttribute('data-prefilled', to.prefilled ? 'true' : 'false');
    });

    a.addEventListener('click', function () {
      track('prompt_open_ai', { ai: chosen.key, id: id });
      if (a.getAttribute('data-prefilled') === 'true') return;
      var text = getText();
      if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
        window.navigator.clipboard.writeText(text).then(
          function () { toast('Prompt copied, paste it in'); },
          function () { toast('Copy it from the card, then paste it in'); }
        );
        return;
      }
      toast('Copy it from the card, then paste it in');
    });

    return a;
  }

  /* The two actions a card offers, on one line: open it, or take the text. */
  function actions(getText, id, what) {
    var row = L.el('div', 'trp-actions');
    row.appendChild(openButton(getText, id, what));
    row.appendChild(copyButton(getText, 'Copy the ' + what));
    return row;
  }

  /* The long version of a card: the pack's own instructions. It is
     self-contained, so pasting it into a blank chat works without anything
     installed. It is simply far longer than the prompt the buttons send,
     which is why it sits behind a fold.

     It used to end with the pack's trigger phrase. That phrase only does
     anything in an AI that has the pack installed, and nobody installs one
     any more, so it was an instruction that quietly did nothing.

     A card with no entry here grows no fold, and loses nothing by it. */
  function fullText(def) {
    var all = window.TRSkillText;
    var body = all && typeof all[def.file] === 'string' ? all[def.file].trim() : '';
    if (!body) return null;
    return body;
  }

  /* ---- one card --------------------------------------------------------- */

  function autopilotText(auto) {
    return [
      'Job: ' + auto.job,
      'Reads: ' + auto.reads,
      'Does: ' + auto.does,
      'Delivers: ' + auto.delivers,
      'Never: send, post or publish anything. Draft only, and wait for me.',
      'Runs: ' + auto.runs
    ].join('\n');
  }

  function card(def) {
    var li = L.el('li', 'glass-card is-static trp-pcard');

    var head = L.el('div', 'trp-pcard-head');
    head.appendChild(L.el('h3', 'trp-pcard-name', def.name));
    li.appendChild(head);

    li.appendChild(L.el('p', 'trp-pcard-one', def.one));

    /* The two actions, straight under the line that says what this does.
       Open is the one anyone came here for, so it is the only filled button
       on the card and nothing sits above it competing. */
    var prompt = PROMPTS[def.file];
    if (prompt) {
      li.appendChild(actions(function () { return prompt; }, def.file, def.name + ' prompt'));
    }

    /* Everything else folds into one row, not two. A card used to end with
       "The full version" and "Put it on autopilot" stacked as separate
       disclosures, which is two thirds of its height spent on things most
       people never open. */
    var full = fullText(def);
    if (!full && !def.auto) return li;

    var acc = L.el('details', 'trp-acc trp-pcard-more');
    var sum = L.el('summary', 'trp-acc-head');
    sum.appendChild(L.el('span', 'trp-acc-title', 'More ways to use this'));
    sum.appendChild(caret());
    acc.appendChild(sum);

    var body = L.el('div', 'trp-acc-body');

    if (full) {
      var fullBox = L.el('div', 'trp-copybox');
      var fullHead = L.el('div', 'trp-copybox-head');
      fullHead.appendChild(L.el('span', 'trp-tag', 'The full version'));
      fullHead.appendChild(copyButton(function () { return full; },
        'Copy the full version of ' + def.name));
      fullBox.appendChild(fullHead);
      fullBox.appendChild(L.el('p', 'trp-acc-note',
        'Every step, for when the short prompt is not enough. Copy it and paste it in.'));
      body.appendChild(fullBox);
    }

    if (def.auto) {
      var autoBox = L.el('div', 'trp-copybox');
      var autoHead = L.el('div', 'trp-copybox-head');
      autoHead.appendChild(L.el('span', 'trp-tag', 'Put it on autopilot'));
      autoHead.appendChild(copyButton(
        function () { return autopilotText(def.auto); },
        'Copy the autopilot brief for ' + def.name));
      autoBox.appendChild(autoHead);
      autoBox.appendChild(L.el('pre', 'trp-copybox-text', autopilotText(def.auto)));
      body.appendChild(autoBox);
    }

    acc.appendChild(body);
    li.appendChild(acc);
    return li;
  }

  function caret() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'trp-acc-caret');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', 'M19 9l-7 7-7-7');
    svg.appendChild(path);
    return svg;
  }

  /* ---- the guides row --------------------------------------------------- */

  // The whole section hides until a guide has a link, heading and all, so the
  // page never shows a title with nothing under it.
  function guidesRow(root) {
    var section = root.closest('[data-prompt-guides]') || root;
    L.clear(root);
    var live = GUIDES.filter(function (g) { return L.str(g.url); });
    if (!live.length) { L.show(section, false); return; }

    var ul = L.el('ul', 'trp-guides');
    live.forEach(function (g) {
      var li = L.el('li', 'trp-guide');
      var a = L.linkTo(g.url, g.title, 'trp-guide-link');
      li.appendChild(a || L.el('span', 'trp-guide-link', g.title));
      ul.appendChild(li);
    });
    root.appendChild(ul);
    L.show(section, true);
  }

  /* ---- render ----------------------------------------------------------- */

  /* The shape, for writing a prompt this page does not have.
     It sits at the foot of the page and folded: it is a wall of monospace,
     and opening the library on it put the one thing most people do not need
     above the sixteen they do. */
  function templateCard() {
    var section = L.el('details', 'glass-card is-static trp-ptemplate');
    section.id = 'write-your-own';

    var head = L.el('summary', 'trp-acc-head trp-ptemplate-head');
    head.appendChild(L.el('span', 'trp-pcard-name', 'Write your own prompt'));
    head.appendChild(caret());
    section.appendChild(head);

    section.appendChild(L.el('p', 'trp-pcard-one', TEMPLATE_INTRO));

    var box = L.el('div', 'trp-copybox');
    var boxHead = L.el('div', 'trp-copybox-head');
    boxHead.appendChild(L.el('span', 'trp-tag', 'The shape'));
    boxHead.appendChild(copyButton(function () { return TEMPLATE; }, 'Copy the prompt template'));
    box.appendChild(boxHead);
    box.appendChild(L.el('pre', 'trp-copybox-text', TEMPLATE));
    section.appendChild(box);

    section.appendChild(actions(function () { return TEMPLATE; }, 'prompt-template', 'prompt template'));
    return section;
  }

  /* Sixteen equal cards in one run read as a wall. They are really two jobs:
     getting your AI set up, and everything LinkedIn. Two headings is the
     whole of the fix, and it costs nothing to scan past the one you do not
     want today. */
  /* `anchor` is the id its heading carries, so a week item in the Curriculum
     can link straight to the run of cards it means rather than to the top of
     the page. Changing one of these breaks that link. */
  var GROUPS = [
    { key: 'setup', anchor: 'set-up-your-ai', title: 'Set up your AI',
      lede: 'Do these once. They give every other prompt something to read.' },
    { key: 'linkedin', anchor: 'linkedin', title: 'LinkedIn',
      lede: 'Write it, post it, and keep up with what comes back.' }
  ];

  // Nothing here reads the payload any more: every card carries its own
  // prompt, so there is no row to match and no week to wait for.
  function render(root) {
    L.clear(root);

    GROUPS.forEach(function (group) {
      var mine = CARDS.filter(function (def) { return def.group === group.key; });
      if (!mine.length) return;

      var head = L.el('div', 'trp-group-head');
      head.id = group.anchor;
      head.appendChild(L.el('h3', 'trp-group-title', group.title));
      head.appendChild(L.el('p', 'trp-group-lede', group.lede));
      root.appendChild(head);

      var ul = L.el('ul', 'trp-pcards');
      mine.forEach(function (def) { ul.appendChild(card(def)); });
      root.appendChild(ul);
    });

    // Last, and closed. The link beside the page title is how anyone finds
    // it, and following that link opens it on the way.
    var own = L.el('div', 'trp-own');
    var tmpl = templateCard();
    own.appendChild(tmpl);
    root.appendChild(own);

    var link = document.querySelector('.trp-own-link');
    if (link) {
      link.addEventListener('click', function () { tmpl.open = true; });
    }
    if (window.location.hash === '#write-your-own') tmpl.open = true;
  }

  /* The cards need nothing from the server, so they are drawn as soon as the
     page is ready rather than waiting on a payload that only the guides row
     still cares about. A member on a slow connection sees their prompts
     straight away. */
  function start() {
    chosen = readChoice();
    var host = document.getElementById('prompt-ai-picker');
    if (host) picker(host);
    var cards = document.getElementById('prompt-cards');
    if (cards) render(cards);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  document.addEventListener('trportal:data', function (event) {
    if (!event || !event.detail) return;
    var guides = document.getElementById('prompt-guides');
    if (guides) guidesRow(guides);
  });
})(window, document);

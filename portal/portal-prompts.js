/* =====================================================================
 * Time Rich portal - Prompt Library renderer.
 *
 * One card per skill: the name, one line on what it does, the phrase to
 * say, and an autopilot brief where a schedule can really run from email,
 * calendar, Notion or call notes.
 *
 * Downloads go through the Worker, never a public link. A card only grows
 * a Download button when the payload contains a matching skill item, which
 * happens only once that week has opened. So the release dates and the
 * member-only rule are the ones portal-access.js already applies; nothing
 * here decides who may have what.
 *
 * createElement + textContent only. Nothing from the payload is ever put
 * through innerHTML.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var L = window.TRLive;
  if (!L) return;

  /* ---- the cards -------------------------------------------------------
     `file` is the name in the portal-skills bucket, which is also what a
     portal_items row of kind "skill" holds in its url column. That is the
     join between a card and its download.

     `week` is the week that row sits in, and it has to match the migration
     that created the rows. It is only ever used for the label on a card whose
     week has not opened yet: portal_get returns no items at all for a locked
     week, so the page cannot work the week out from the payload. It never
     decides whether a download happens. The Worker does that, from the row.
     A card with no week is one with no row yet, and shows nothing.

     `say` is the exact trigger phrase. Where it is quoted in the pack's own
     SKILL.md it is reproduced verbatim, including American spelling.

     `auto` is present only where a scheduled run has something real to read.
     A skill that needs a live LinkedIn page has no autopilot. */
  var CARDS = [
    {
      file: 'compass-superhuman.zip',
      week: 0,
      name: 'Build my context',
      one: 'Builds your Business COMPASS from your own calls, docs, email and Notion, then shows where your time goes.',
      say: 'Superhuman: build my context',
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
      week: 0,
      name: 'Lock down my Claude',
      one: 'Walks you through three privacy settings in your AI before you connect anything, and reports back what changed.',
      say: 'Superhuman: lock down my Claude'
    },
    {
      file: 'story-superhuman.zip',
      week: 3,
      name: 'Build my story bank',
      one: 'Pulls the stories you already tell out of your own transcripts and banks them in one place.',
      say: 'Superhuman: build my story bank',
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
      name: 'Audit my LinkedIn',
      one: 'Scores your LinkedIn profile against one 90 day goal and one ideal client, then gives you ranked fixes with drafts.',
      say: 'Audit my LinkedIn against my goal and my ICP'
    },
    {
      file: 'linkedin-profile-optimizer.zip',
      week: 3,
      name: 'Optimise my profile',
      one: 'Rewrites your whole LinkedIn profile, from the headline to the recommendations.',
      say: 'review my profile'
    },
    {
      file: 'linkedin-content-planner.zip',
      week: 3,
      name: 'Plan my week',
      one: 'Builds a seven day LinkedIn plan with a pillar, a format and a hook for each day.',
      say: 'plan my week',
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
      week: 3,
      name: 'Write a post',
      one: 'Writes a LinkedIn post from scratch using a proven hook, then takes the AI tells out of it.',
      say: 'write a post',
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
      week: 3,
      name: 'Break down a hook',
      one: 'Takes a post that worked and tells you which hook formula it used, and why.',
      say: 'break down this hook'
    },
    {
      file: 'linkedin-humanizer.zip',
      week: 3,
      name: 'Humanise a draft',
      one: 'Takes the AI tells out of a draft, and audits a post before you publish it.',
      say: 'humanize this',
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
      week: 3,
      name: 'Repurpose something',
      one: 'Rebuilds a tweet, video, blog or newsletter as a native LinkedIn post.',
      say: 'repurpose this for LinkedIn',
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
      week: 3,
      name: 'Interview me',
      one: 'Interviews you for the raw material your posts are made of.',
      say: 'interview me',
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
      week: 3,
      name: 'Comment on a post',
      one: 'Drafts a comment on someone else’s post, in your voice.',
      say: 'draft me a comment'
    },
    {
      file: 'linkedin-reply-handler.zip',
      week: 3,
      name: 'Clear my comments',
      one: 'Drafts a reply to one comment, or sweeps a whole post and replies to every comment worth answering.',
      say: 'clear the comments on this post'
    },
    {
      file: 'linkedin-thread-monitor.zip',
      week: 3,
      name: 'Find my warm threads',
      one: 'Tracks which of your comments got a reply, and flags the ones worth following up now.',
      say: 'what threads need follow-up'
    },
    {
      file: 'linkedin-engager-analytics.zip',
      week: 3,
      name: 'Who engaged',
      one: 'Pulls everyone who liked or commented on a post and sorts them by how well they fit your ideal client.',
      say: 'who liked my post'
    },
    {
      file: 'linkedin-employee-advocacy.zip',
      week: 3,
      name: 'Get the team posting',
      one: 'Sets up and runs a LinkedIn program for your team, from the launch plan to the numbers.',
      say: 'get the team posting'
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

  function card(def, item, locked) {
    var li = L.el('li', 'glass-card is-static trp-pcard');

    var head = L.el('div', 'trp-pcard-head');
    head.appendChild(L.el('h3', 'trp-pcard-name', def.name));
    // The pack is here, or its week has not opened, or it has not been built
    // yet. The third case used to say nothing at all, which read as a bug.
    var get = item ? downloadButton(def, item) : null;
    if (get) head.appendChild(get);
    else if (locked) head.appendChild(lockedLabel(def));
    else head.appendChild(comingSoonLabel(def));
    li.appendChild(head);

    li.appendChild(L.el('p', 'trp-pcard-one', def.one));

    // the phrase to say
    var sayBox = L.el('div', 'trp-saybox');
    var sayHead = L.el('div', 'trp-saybox-head');
    sayHead.appendChild(L.el('span', 'trp-tag', 'Say this'));
    sayHead.appendChild(copyButton(function () { return def.say; }, 'Copy the phrase for ' + def.name));
    sayBox.appendChild(sayHead);
    sayBox.appendChild(L.el('p', 'trp-saybox-text', def.say));
    li.appendChild(sayBox);

    if (def.auto) {
      var acc = L.el('details', 'trp-acc trp-pcard-auto');
      var sum = L.el('summary', 'trp-acc-head');
      sum.appendChild(L.el('span', 'trp-acc-title', 'Put it on autopilot'));
      sum.appendChild(caret());
      acc.appendChild(sum);

      var body = L.el('div', 'trp-acc-body');
      var box = L.el('div', 'trp-copybox');
      var boxHead = L.el('div', 'trp-copybox-head');
      boxHead.appendChild(L.el('span', 'trp-tag', 'The brief'));
      boxHead.appendChild(copyButton(
        function () { return autopilotText(def.auto); },
        'Copy the autopilot brief for ' + def.name));
      box.appendChild(boxHead);
      box.appendChild(L.el('pre', 'trp-copybox-text', autopilotText(def.auto)));
      body.appendChild(box);
      acc.appendChild(body);
      li.appendChild(acc);
    }

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

  /* The shared button from portal-access.js, so the gated-download flow lives
     in exactly one place. It posts the item id to the Worker, which re-checks
     the session and the week's release date before signing a URL good for
     five minutes. Only the class list is ours. */
  // Said in the same place the Download button would sit, so the card does
  // not change shape on the day the week opens.
  //
  // "Download unlocks" rather than "Unlocks": the phrase above is there to be
  // copied right now, and only the pack is held back.
  function lockedLabel(def) {
    var span = L.el('span', 'trp-pcard-locked', 'Download unlocks Week ' + def.week);
    span.setAttribute('aria-label', 'The ' + def.name + ' download unlocks in week ' + def.week);
    return span;
  }

  // A pack that has not been built yet: no week to name and no row to download
  // from. Same slot and same style as the locked label, so the card keeps its
  // shape and the reader is told why there is no button.
  function comingSoonLabel(def) {
    var span = L.el('span', 'trp-pcard-locked', 'Download coming soon');
    span.setAttribute('aria-label', 'The ' + def.name + ' download is coming soon');
    return span;
  }

  function downloadButton(def, item) {
    if (!window.TRPortal || typeof window.TRPortal.skillButton !== 'function') return null;
    var btn = window.TRPortal.skillButton(item);
    if (!btn) return null;
    btn.className = 'trp-pcard-get';
    btn.setAttribute('aria-label', 'Download the ' + def.name + ' skill');
    return btn;
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

  // Every skill item the member can actually have today, by file name.
  function openSkills(data) {
    var byFile = {};
    L.weeks(data).forEach(function (week) {
      if (week.unlocked !== true) return;
      L.items(week).forEach(function (item) {
        if (!item || item.kind !== 'skill') return;
        var file = L.str(item.url);
        if (file) byFile[file] = item;
      });
    });
    return byFile;
  }

  // A week that exists in the payload and has not opened yet. A week that is
  // not in the payload at all is not a week this member has, so there is
  // nothing honest to say about it.
  function lockedWeek(data, n) {
    if (typeof n !== 'number') return null;
    var week = L.weeks(data).filter(function (w) { return L.num(w && w.id) === n; })[0];
    if (!week || week.unlocked === true) return null;
    return week;
  }

  function render(root, data) {
    L.clear(root);
    var open = openSkills(data);
    var ul = L.el('ul', 'trp-pcards');
    CARDS.forEach(function (def) {
      var item = open[def.file] || null;
      ul.appendChild(card(def, item, item ? null : lockedWeek(data, def.week)));
    });
    root.appendChild(ul);
  }

  document.addEventListener('trportal:data', function (event) {
    var data = event && event.detail;
    if (!data) return;
    var cards = document.getElementById('prompt-cards');
    if (cards) render(cards, data);
    var guides = document.getElementById('prompt-guides');
    if (guides) guidesRow(guides);
  });
})(window, document);

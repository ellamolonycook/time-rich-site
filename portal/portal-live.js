/* =====================================================================
 * Time Rich portal - shared helpers for the live-data pages.
 *
 * Every portal page that renders portal_get listens for the
 * `trportal:data` event that portal-access.js fires, and builds its DOM
 * through the helpers here.
 *
 * Two rules, both deliberate:
 *   - nothing from the API ever reaches innerHTML. Elements are made with
 *     createElement and filled with textContent.
 *   - a link is only ever an absolute https URL, checked by safeUrl.
 *
 * Times are always shown in Eastern Time, because that is the time the
 * sessions are announced in, whatever time zone the member is reading in.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var TZ = 'America/New_York';
  var SESSION_MINUTES = 75;

  /* ---- DOM ------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null && text !== '') node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function show(node, visible) {
    if (!node) return;
    if (visible) node.removeAttribute('hidden');
    else node.setAttribute('hidden', '');
  }

  function str(value) {
    return String(value == null ? '' : value).trim();
  }

  /* ---- links ---------------------------------------------------------- */

  // Absolute https only, the same rule portal-access.js applies. Anything
  // else returns null and the caller leaves the link out entirely.
  function safeUrl(raw) {
    var value = str(raw);
    if (!value) return null;
    var parsed;
    try { parsed = new URL(value); } catch (e) { return null; }
    return parsed.protocol === 'https:' ? parsed : null;
  }

  function linkTo(href, text, className) {
    var url = safeUrl(href);
    if (!url) return null;
    var a = el('a', className, text);
    a.href = url.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  /* ---- time ----------------------------------------------------------- */

  function toDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  // "Mon 26 Oct · 12pm ET"
  function etDateTime(iso) {
    var d = toDate(iso);
    if (!d) return '';
    return etDate(iso) + ' · ' + etTime(iso) + ' ET';
  }

  // "Mon 26 Oct"
  function etDate(iso) {
    var d = toDate(iso);
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short'
      }).format(d).replace(/,/g, '');
    } catch (e) {
      return d.toDateString();
    }
  }

  // "12pm" / "12:30pm"
  function etTime(iso) {
    var d = toDate(iso);
    if (!d) return '';
    try {
      var raw = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true
      }).format(d);
      return raw.replace(':00', '').replace(/\s*([AP])M/i, function (m, p) {
        return p.toLowerCase() + 'm';
      });
    } catch (e) {
      return '';
    }
  }

  /* ---- calendar ------------------------------------------------------- */

  function icsStamp(d) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function icsEscape(value) {
    return str(value).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  }

  // A calendar file built in the browser, so no round trip and nothing to
  // host. Sessions run 75 minutes.
  function icsBlobUrl(session) {
    var start = toDate(session && session.starts_at);
    if (!start) return '';
    var end = new Date(start.getTime() + SESSION_MINUTES * 60000);
    var join = safeUrl(session && session.join_url);

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Time Rich//Accelerator Portal//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + icsStamp(start) + '-timerich@timerich.ai',
      'DTSTAMP:' + icsStamp(new Date()),
      'DTSTART:' + icsStamp(start),
      'DTEND:' + icsStamp(end),
      'SUMMARY:' + icsEscape(str(session && session.title) || 'Time Rich session')
    ];
    if (join) {
      lines.push('URL:' + icsEscape(join.href));
      lines.push('DESCRIPTION:' + icsEscape('Join: ' + join.href));
    }
    lines.push('END:VEVENT', 'END:VCALENDAR');

    try {
      return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    } catch (e) {
      return '';
    }
  }

  // Returns an <a> that downloads the .ics, or null when there is no date.
  function calendarLink(session, text, className) {
    var href = icsBlobUrl(session);
    if (!href) return null;
    var a = el('a', className, text);
    a.href = href;
    a.setAttribute('download', (str(session.title) || 'session').replace(/[^\w -]+/g, '') + '.ics');
    return a;
  }

  /* ---- payload -------------------------------------------------------- */

  function weeks(data) {
    var list = (data && Array.isArray(data.weeks)) ? data.weeks.slice() : [];
    list.sort(function (a, b) { return num(a && a.id) - num(b && b.id); });
    return list;
  }

  function sessions(data) {
    var list = (data && Array.isArray(data.sessions)) ? data.sessions.slice() : [];
    list.sort(function (a, b) {
      return (toDate(a && a.starts_at) || 0) - (toDate(b && b.starts_at) || 0);
    });
    return list;
  }

  function num(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function items(week) {
    var list = (week && Array.isArray(week.items)) ? week.items.slice() : [];
    list.sort(function (a, b) {
      return num(a && a.sort) - num(b && b.sort) || num(a && a.id) - num(b && b.id);
    });
    return list;
  }

  // The newest week the member can actually open.
  function latestUnlockedWeek(data) {
    var open = weeks(data).filter(function (w) { return w && w.unlocked === true; });
    return open.length ? open[open.length - 1] : null;
  }

  function nextSession(data, now) {
    var at = now || new Date();
    var list = sessions(data);
    for (var i = 0; i < list.length; i++) {
      var d = toDate(list[i] && list[i].starts_at);
      if (d && d.getTime() > at.getTime()) return list[i];
    }
    return null;
  }

  // YYYY-MM-DD in a given IANA zone (or the browser's local zone when omitted).
  // Used to decide "has this session's calendar day started for this member?".
  function dateKey(isoOrDate, timeZone) {
    var d = isoOrDate instanceof Date ? isoOrDate : toDate(isoOrDate);
    if (!d) return '';
    try {
      var opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
      if (timeZone) opts.timeZone = timeZone;
      var parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(d);
      var y = '', m = '', day = '';
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'year') y = parts[i].value;
        else if (parts[i].type === 'month') m = parts[i].value;
        else if (parts[i].type === 'day') day = parts[i].value;
      }
      return y && m && day ? y + '-' + m + '-' + day : '';
    } catch (e) {
      return '';
    }
  }

  // A session unlocks once the Eastern calendar day of starts_at has begun.
  // The cohort is scheduled in ET, so every member unlocks at the same
  // absolute moment (midnight America/New_York), not at their local midnight.
  // starts_at is timestamptz; dateKey in TZ avoids UTC-day drift.
  function isSessionUnlocked(session, now) {
    var at = now || new Date();
    var start = toDate(session && session.starts_at);
    if (!start) return false;
    var todayEt = dateKey(at, TZ);
    var dayEt = dateKey(start, TZ);
    return Boolean(todayEt && dayEt && todayEt >= dayEt);
  }

  function isSessionPast(session, now) {
    var at = now || new Date();
    var start = toDate(session && session.starts_at);
    if (!start) return false;
    return start.getTime() + SESSION_MINUTES * 60000 <= at.getTime();
  }

  // The most recent past session that actually has a recording.
  function latestRecording(data, now) {
    var at = now || new Date();
    var list = sessions(data).filter(function (s) {
      var d = toDate(s && s.starts_at);
      return d && d.getTime() <= at.getTime() && safeUrl(s && s.recording_url);
    });
    return list.length ? list[list.length - 1] : null;
  }

  function sessionsForWeek(data, weekId) {
    return sessions(data).filter(function (s) { return num(s && s.week_id) === num(weekId); });
  }

  // Finds a link item in a week by a loose title match, so "WhatsApp group"
  // and "Join the WhatsApp" both answer to "whatsapp". Returns null when
  // there is no such item, and the caller hides its link.
  function findLinkItem(data, weekId, needle) {
    var want = str(needle).toLowerCase();
    if (!want) return null;
    var list = weeks(data).filter(function (w) { return num(w && w.id) === num(weekId); });
    for (var i = 0; i < list.length; i++) {
      var found = items(list[i]).filter(function (item) {
        return item && item.kind === 'link' &&
               str(item.title).toLowerCase().indexOf(want) !== -1 &&
               safeUrl(item.url);
      });
      if (found.length) return found[0];
    }
    return null;
  }

  window.TRLive = {
    el: el,
    clear: clear,
    show: show,
    str: str,
    num: num,
    safeUrl: safeUrl,
    linkTo: linkTo,
    toDate: toDate,
    etDate: etDate,
    etTime: etTime,
    etDateTime: etDateTime,
    icsBlobUrl: icsBlobUrl,
    calendarLink: calendarLink,
    weeks: weeks,
    sessions: sessions,
    items: items,
    latestUnlockedWeek: latestUnlockedWeek,
    nextSession: nextSession,
    dateKey: dateKey,
    isSessionUnlocked: isSessionUnlocked,
    isSessionPast: isSessionPast,
    latestRecording: latestRecording,
    sessionsForWeek: sessionsForWeek,
    findLinkItem: findLinkItem,
    SESSION_MINUTES: SESSION_MINUTES
  };

})(window, document);

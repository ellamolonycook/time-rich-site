/* club/feedback.html — the Club feedback and testimonial form.
 *
 * Ella, 5 Nov: "Let's create a feedback short form, and the ability to submit
 * your video and written testimonial. We want it to be so they do it on
 * LinkedIn."
 *
 * The field names are the contract with the Worker, which is the contract
 * with Notion: createApplication maps a posted key to the database property
 * of the same name, so a rename here is a rename in three places at once.
 * That is what most of this file is checking.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const HTML = read('club/feedback.html');
const ACCESS = read('club/portal-access.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const doc = new JSDOM(HTML, { virtualConsole: new VirtualConsole() }).window.document;
const form = doc.querySelector('[data-feedback-form]');

/* ---- gated like the rest of the Club ----------------------------------- */

console.log('\nsigned-out visitors are sent to sign in, like every Club page');
{
  check('the page carries the session gate', /<html[^>]*data-trp-gate/.test(HTML));
  check('and loads the gate script', HTML.includes('portal-access.js'));
  check('with the portal config before it',
    HTML.indexOf('portal-config.js') < HTML.indexOf('portal-access.js'));

  /* There is deliberately no sign-in form on this page. portal-access.js
     shows [data-portal-login] when it has one and otherwise sends the
     browser to signin, which is what every other Club page relies on. */
  check('it has no sign-in form of its own, so the gate redirects',
    doc.querySelector('[data-portal-login]') === null);
  check('and that is what portal-access.js does with no session',
    /function signedOut\(\)[\s\S]*?window\.location\.replace\('signin'\);/.test(ACCESS));

  check('the member name hook is on the page, so the session is loaded',
    doc.querySelector('[data-portal-name]') !== null);
  check('no link on the page ends in .html',
    [...doc.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => /^(?!https?:|mailto:)[^:]*\.html(?:[?#]|$)/.test(h)).length === 0,
    [...doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
      .filter((h) => /\.html/.test(h)));
}

/* ---- what it says ------------------------------------------------------ */

console.log('\nit says what it is, and how long it takes');
{
  check('the heading is Ella\'s', /Tell us how it(’|')s going/.test(doc.querySelector('h1').textContent),
    doc.querySelector('h1').textContent);
  const text = doc.body.textContent.replace(/\s+/g, ' ');
  check('and the one line under it is too',
    text.includes('2 minutes. It shapes the next cohort.'));
  check('the title names the Club', /Feedback \| Time Rich Club/.test(HTML));
  check('and the canonical is the new address',
    HTML.includes('href="https://timerich.ai/club/feedback"'));
}

/* ---- the fields, by the names they post under -------------------------- */

console.log('\nevery field posts under the name the Worker and Notion expect');
{
  check('there is one form', form !== null);

  const named = [...form.querySelectorAll('[name]')];
  const names = [...new Set(named.map((e) => e.getAttribute('name')))];
  const WANT = [
    'Name',
    'Email',
    'Rating',
    'Most useful',
    'One thing to change',
    'LinkedIn recommendation',
    'LinkedIn recommendation link',
    'LinkedIn video post',
    'OK to feature',
    'Source',
    '_gotcha',
  ];
  for (const want of WANT) {
    check('it posts "' + want + '"', names.includes(want), names);
  }
  check('and nothing else', names.filter((n) => !WANT.includes(n)).length === 0,
    names.filter((n) => !WANT.includes(n)));

  check('Source is club-feedback',
    form.querySelector('[name="Source"]').value === 'club-feedback',
    form.querySelector('[name="Source"]').value);
  check('the honeypot is there and off-screen, not display:none',
    form.querySelector('[name="_gotcha"]') !== null &&
    /\.trp-fb-pot\s*\{[^}]*left:\s*-9999px/.test(HTML));
  check('and a person never tabs into it',
    form.querySelector('[name="_gotcha"]').getAttribute('tabindex') === '-1');
}

console.log('\nPart 1: the rating is one tap, 1 to 10');
{
  const radios = [...form.querySelectorAll('input[name="Rating"]')];
  check('ten of them', radios.length === 10, radios.length);
  check('values 1 to 10, in order',
    radios.map((r) => r.value).join(',') === '1,2,3,4,5,6,7,8,9,10',
    radios.map((r) => r.value));
  check('they are radios, so it is one tap and one answer',
    radios.every((r) => r.type === 'radio'));
  check('every number is labelled with itself',
    radios.every((r) => r.closest('label').textContent.trim() === r.value),
    radios.map((r) => r.closest('label').textContent.trim()));
  check('the group has a legend, so it is read as one question',
    radios[0].closest('fieldset') !== null &&
    /How(’|')s the accelerator going for you\?/
      .test(radios[0].closest('fieldset').querySelector('legend').textContent),
    radios[0].closest('fieldset').querySelector('legend').textContent);

  for (const [name, label] of [
    ['Most useful', 'What’s been most useful so far?'],
    ['One thing to change', 'One thing we should change?'],
  ]) {
    const field = form.querySelector('[name="' + name + '"]');
    check('"' + name + '" is a text field', field !== null && field.tagName === 'TEXTAREA');
    check('and it is not required, because it is optional',
      field && !field.hasAttribute('required'));
    const text = field.closest('.trp-fb-field').textContent.replace(/\s+/g, ' ');
    check('it asks "' + label + '"', text.includes(label), text.trim());
    check('and says it is optional', /\(optional\)/.test(text), text.trim());
  }
}

console.log('\nPart 2: the testimonial goes on LinkedIn');
{
  const text = form.textContent.replace(/\s+/g, ' ');

  // Written: the button, and the two taps that record it.
  const ella = [...form.querySelectorAll('a')]
    .filter((a) => /linkedin\.com\/in\/ellamolonycook/.test(a.getAttribute('href') || ''));
  check('one button to Ella\'s profile', ella.length === 1,
    ella.map((a) => a.getAttribute('href')));
  check('it says what it is for',
    ella[0].textContent.replace(/\s+/g, ' ').includes('Write Ella a recommendation on LinkedIn'),
    ella[0].textContent.trim());
  check('and it opens in a new tab, safely',
    ella[0].getAttribute('target') === '_blank' &&
    /\bnoopener\b/.test(ella[0].getAttribute('rel') || ''),
    [ella[0].getAttribute('target'), ella[0].getAttribute('rel')]);
  check('the steps are one line, as Ella wrote them',
    text.includes('On Ella’s profile, click More, then Recommend.'));

  const rec = [...form.querySelectorAll('input[name="LinkedIn recommendation"]')];
  check('Done / Not yet, in that order',
    rec.map((r) => r.value).join(',') === 'Done,Not yet', rec.map((r) => r.value));
  check('and it is one answer, not a checkbox each',
    rec.length === 2 && rec.every((r) => r.type === 'radio'));
  check('neither is required', rec.every((r) => !r.hasAttribute('required')));

  const recLink = form.querySelector('[name="LinkedIn recommendation link"]');
  check('the link to it is optional', recLink !== null && !recLink.hasAttribute('required'));

  // Video: the ask, and the field it is pasted into.
  check('the video ask is one line, as Ella wrote it',
    text.includes('Post a 30 to 60 second video on LinkedIn about what you’ve built, ' +
                  'tag Ella Molony Cook and use #trcsuperhuman.'));
  const video = form.querySelector('[name="LinkedIn video post"]');
  check('there is somewhere to paste the post link', video !== null);
  check('it is a url field, and optional',
    video.type === 'url' && !video.hasAttribute('required'));
  check('and it is asked for by name',
    video.closest('.trp-fb-field').textContent.includes('Paste your LinkedIn post link'));

  const share = [...form.querySelectorAll('input[name="OK to feature"]')];
  check('Yes / No on sharing it', share.map((r) => r.value).join(',') === 'Yes,No',
    share.map((r) => r.value));
  check('asked as Ella put it',
    text.includes('Time Rich can share my feedback and testimonial'));
}

/* ---- the submit --------------------------------------------------------- */

console.log('\nsubmitting posts to the Worker, and says what happened');
{
  check('it posts to the forms Worker\'s /feedback route',
    HTML.includes("'https://time-rich-forms.timerich.workers.dev/feedback'"));
  check('as JSON',
    /method: 'POST'[\s\S]{0,200}'Content-Type': 'application\/json'/.test(HTML));

  check('there is one submit button', form.querySelectorAll('button[type="submit"]').length === 1);
  check('and somewhere to say how it went',
    form.querySelector('[data-feedback-msg]') !== null &&
    form.querySelector('[data-feedback-msg]').getAttribute('aria-live') === 'polite');

  check('success says what Ella wrote, emoji and all',
    /Thank you!! \\uD83D\\uDC9A You\\u2019re in the running for the Testimonial Prize if you did both\./
      .test(HTML));
  check('and a Worker error is shown rather than swallowed',
    /res\.body && res\.body\.error/.test(HTML));

  // The page checks the two things it can, so the member hears about them
  // here rather than after a round trip.
  check('the rating is checked on the page, 1 to 10',
    /\^\(\[1-9\]\|10\)\$/.test(HTML));
  check('and the message is the same one the Worker gives',
    HTML.includes('Please pick a number from 1 to 10.'));
  check('the post link is checked with the same test the draw uses',
    HTML.includes('/linkedin\\.com\\/./i') &&
    read('contentworkshop/index.html').includes('/linkedin\\.com\\/./i'));

  /* Name comes off the session. Email cannot: the browser keeps the session
     token after sign-in and never the address, so the member types it. */
  check('the name is filled from the member\'s session',
    /data-feedback-name/.test(HTML) && /member\.first_name/.test(HTML));
  check('and the email is asked for, since nothing holds it',
    form.querySelector('[name="Email"]').hasAttribute('required'));
}

/* ---- the way in -------------------------------------------------------- */

console.log('\nthe Club points at it');
{
  const CLUB_PAGES = ['index', 'dashboard', 'curriculum', 'resources', 'prompts', 'members', 'feedback'];
  for (const name of CLUB_PAGES) {
    const page = read('club/' + name + '.html');
    check(name + ': the footer carries Give feedback',
      page.includes('<a href="/club/feedback" class="trp-foot-link">Give feedback</a>'));
  }
  check('and every week ends by asking',
    /How's it going\? Tell us in 2 minutes/.test(read('club/curriculum.html')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

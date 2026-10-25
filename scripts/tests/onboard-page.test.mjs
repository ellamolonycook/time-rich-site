// The /onboard page, run for real in jsdom: the page's own inline script
// drives the three states, so these load it the way a buyer arrives.
//
// The rule this suite exists to pin is the one a real buyer fell through: a
// buyer who chose "Decide later" at checkout has a saved choice, so the order
// reads as completed, but their plus one is still missing. The completed
// screen told them to come back before kickoff and then gave them no form to
// do it in. A "Not sure" buyer must land on the form.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../../onboard/index.html', import.meta.url), 'utf8');
const WORKER = 'https://time-rich-forms.timerich.workers.dev/onboard';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/**
 * A fresh page with its inline script run.
 *   query    - the query string the buyer arrives with
 *   lookup   - the JSON the worker answers the GET with
 *   save     - 'ok' | 'error' for the POST that saves the plus one
 */
function load(opts = {}) {
  const net = { gets: [], posts: [] };
  const logs = [];

  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/onboard/' + (opts.query || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.console.warn = (...args) => logs.push(args.map(String).join(' '));

      // jsdom ships no fetch, so this is the whole network.
      window.fetch = (url, init) => {
        if (!init || (init.method || 'GET') === 'GET') {
          net.gets.push(String(url));
          const body = opts.lookup || { ok: true, verified: false, message: 'No paid order found' };
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
        }
        net.posts.push({ url: String(url), body: JSON.parse(init.body) });
        if (opts.save === 'error') {
          return Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ ok: false }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
      };
    },
  });

  const { document } = dom.window;
  const shown = (id) => document.getElementById(id).style.display !== 'none';
  return {
    dom,
    document,
    net,
    logs,
    state: () => (shown('completedState') ? 'completed'
      : shown('verifiedFormState') ? 'form'
      : shown('unverifiedState') ? 'unverified' : 'none'),
    completedSub: () => document.getElementById('completedSub').textContent,
    /** The option the form is sitting on, read off the markup the buyer sees. */
    selected: () => (document.getElementById('optNamed').classList.contains('selected') ? 'named'
      : document.getElementById('optUndecided').classList.contains('selected') ? 'undecided' : 'none'),
    fieldsOpen: () => document.getElementById('namedFields').style.display !== 'none',
    fill: (first, last, email) => {
      document.getElementById('attFirstName').value = first;
      document.getElementById('attLastName').value = last;
      document.getElementById('attEmail').value = email;
    },
    submitSeat: () => {
      document.querySelector('#verifiedFormState form')
        .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      return settle();
    },
    lookupWith: (email) => {
      document.getElementById('lookupEmail').value = email;
      document.querySelector('#unverifiedState form')
        .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      return settle();
    },
  };
}

/** Lets the page's promise chain run to completion. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** initOnboard() is deferred to DOMContentLoaded, so wait for it, then settle. */
async function ready(page) {
  if (page.document.readyState === 'loading') {
    await new Promise((resolve) => page.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  await settle();
}

const verified = (extra) => ({
  ok: true,
  verified: true,
  firstName: 'Rikki',
  paymentStatus: 'Paid',
  questionnaireCompleted: false,
  whatsappUrl: 'https://chat.whatsapp.com/test',
  ...extra,
});

console.log('\n/onboard - the "Not sure yet" return visit');
{
  const page = load({
    query: '?email=rikki@example.com',
    lookup: verified({ secondSeatChoice: 'Not Sure yet', isCompleted: true }),
  });
  await ready(page);

  check('a "Not sure yet" buyer lands on the form, not the completed screen',
    page.state() === 'form', page.state());
  check('...with "Add them now" selected', page.selected() === 'named', page.selected());
  check('...and the name and email fields open', page.fieldsOpen());
  check('...and still greeted by name',
    /Rikki/.test(page.document.getElementById('welcomeTitle').textContent));

  // Now they do what the completed screen had promised they could.
  page.fill('Sam', 'Okafor', 'sam@example.com');
  await page.submitSeat();

  check('the plus one is posted as a named attendee',
    page.net.posts.length === 1 &&
    page.net.posts[0].url === WORKER &&
    page.net.posts[0].body.choice === 'named' &&
    page.net.posts[0].body.attendeeFirstName === 'Sam' &&
    page.net.posts[0].body.attendeeLastName === 'Okafor' &&
    page.net.posts[0].body.attendeeEmail === 'sam@example.com',
    page.net.posts);
  check('...on the same order they verified with',
    page.net.posts[0].body.email === 'rikki@example.com', page.net.posts[0].body);
  check('...and they land on the completed screen',
    page.state() === 'completed', page.state());
  check('...which now says both seats are saved',
    page.completedSub() === 'Your seat and plus one are saved.', page.completedSub());
}

console.log('\n/onboard - a buyer who already named their plus one');
{
  const page = load({
    query: '?email=nina@example.com',
    lookup: verified({ secondSeatChoice: 'Named Attendee', isCompleted: true }),
  });
  await ready(page);

  check('goes straight to the completed screen', page.state() === 'completed', page.state());
  check('...which says both seats are saved',
    page.completedSub() === 'Your seat and plus one are saved.', page.completedSub());
  check('...with the WhatsApp invite wired up',
    page.document.getElementById('whatsappLink').href === 'https://chat.whatsapp.com/test');
  check('...and nothing is posted', page.net.posts.length === 0);
}

console.log('\n/onboard - a buyer who has not chosen yet');
{
  const page = load({
    query: '?email=theo@example.com',
    lookup: verified({ secondSeatChoice: '', isCompleted: false }),
  });
  await ready(page);

  check('sees the form', page.state() === 'form', page.state());
  check('...on "Add them now"', page.selected() === 'named', page.selected());

  // "Decide later" is still a real answer, and still confirms that way.
  page.document.getElementById('optUndecided')
    .dispatchEvent(new page.dom.window.MouseEvent('click', { bubbles: true }));
  check('...and can still pick "Decide later"',
    page.selected() === 'undecided' && page.fieldsOpen() === false);

  await page.submitSeat();
  check('which posts the undecided choice',
    page.net.posts.length === 1 && page.net.posts[0].body.choice === 'undecided', page.net.posts);
  check('...and says the plus one is still open',
    page.state() === 'completed' &&
    page.completedSub() === 'Your seat is saved. Add your plus one any time before kickoff.',
    page.completedSub());
}

console.log('\n/onboard - the lookup form');
{
  const page = load({ lookup: verified({ secondSeatChoice: 'Not Sure yet', isCompleted: true }) });
  await ready(page);

  check('an arrival with no order details asks for the email',
    page.state() === 'unverified', page.state());
  check('...without calling the worker', page.net.gets.length === 0, page.net.gets);

  await page.lookupWith('rikki@example.com');
  check('a "Not sure yet" buyer who looks themselves up also gets the form',
    page.state() === 'form' && page.selected() === 'named', page.state());
  check('...and the lookup button is back to rest',
    page.document.getElementById('btnLookup').disabled === false &&
    page.document.getElementById('btnLookup').textContent === 'Verify Order');
}

{
  const page = load({ query: '?email=nobody@example.com' });
  await ready(page);
  check('an order we cannot verify says so and keeps the lookup form',
    page.state() === 'unverified' &&
    page.document.getElementById('lookupMsg').style.display === 'block',
    page.document.getElementById('lookupMsg').textContent);
}

{
  const page = load({
    query: '?email=rikki@example.com',
    lookup: verified({ secondSeatChoice: 'Not Sure yet', isCompleted: true }),
    save: 'error',
  });
  await ready(page);
  page.fill('Sam', 'Okafor', 'sam@example.com');
  await page.submitSeat();
  check('a failed save keeps the buyer on the form with the error said',
    page.state() === 'form' &&
    page.document.getElementById('seatMsg').style.display === 'block',
    page.document.getElementById('seatMsg').textContent);
  check('...and the Confirm button is pressable again',
    page.document.getElementById('btnSeatSubmit').disabled === false &&
    page.document.getElementById('btnSeatSubmit').textContent === 'Confirm');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

// Regressions for the delayed body-fade navigation competing with native
// view transitions. Run with: node scripts/tests/portal-navigation.test.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const pages = ['club', 'dashboard', 'curriculum', 'resources', 'members', 'sessions', 'prompts', 'index'];
let linksChecked = 0;
for (const page of pages) {
  const html = process.env.NAV_TEST_BASELINE === '1'
    ? execFileSync('git', ['show', 'HEAD:portal/' + page + '.html'], {encoding:'utf8'})
    : readFileSync(new URL('../../portal/' + page + '.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://timerich.ai/portal/' + page + '.html',
    runScripts: 'outside-only', virtualConsole: new VirtualConsole()
  });
  const w = dom.window, d = w.document;
  w.matchMedia = () => ({ matches: false });
  // Exercise any page-transition click handler, without running authentication,
  // analytics or content renderers. The removed handler fails these assertions.
  for (const script of d.querySelectorAll('script:not([src])')) {
    if (script.textContent.includes('SMOOTH PAGE TRANSITIONS')) w.eval(script.textContent);
  }
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  const links = [...d.querySelectorAll('#top-nav a[href], #mobile-menu a[href], nav[aria-label="Accelerator"] a[href]')];
  for (const link of links) {
    const url = new URL(link.href);
    if (url.origin !== w.location.origin) continue;
    const path = url.pathname === '/club' ? 'club/index.html' : url.pathname.slice(1);
    assert(existsSync(new URL('../../' + path, import.meta.url)), page + ': missing destination ' + path);
    // Rapid clicks and modified clicks must retain native navigation behavior.
    for (const options of [{}, {}, {ctrlKey:true}, {metaKey:true}]) {
      const event = new w.MouseEvent('click', {bubbles:true, cancelable:true, button:0, ...options});
      link.dispatchEvent(event);
      assert(!event.defaultPrevented, page + ': navigation intercepted for ' + link.textContent.trim());
      assert.notEqual(d.body.style.opacity, '0', page + ': page hidden before navigation');
      assert.equal(d.body.style.transform, '', page + ': page shrunk before navigation');
    }
    linksChecked++;
  }
  if (page === 'club') assert.equal(d.querySelector('base').target, '_top');

  /* The light/dark choice is one shared file, loaded by every portal page.
     It was copied into the foot of seven of the eight instead, and Club was
     the one that never got the copy -- so its toggle dispatched a `change`
     nobody listened for and clicking it did nothing. A page that carries its
     own copy again, or stops loading the shared one, is that bug coming back. */
  const theme = [...d.querySelectorAll('script[src]')]
    .filter((t) => /portal-theme\.js/.test(t.getAttribute('src')));
  assert.equal(theme.length, 1, page + ': should load portal-theme.js exactly once');
  assert(theme[0].hasAttribute('defer'), page + ': portal-theme.js should be deferred');

  const inline = [...d.querySelectorAll('script:not([src])')].map((t) => t.textContent);
  const writers = inline.filter((t) => /localStorage\.setItem\('tr_portal_theme'/.test(t));
  assert.equal(writers.length, 0, page + ': the theme is written by the shared file, not inline');

  // The pre-paint reader does stay inline: over the network it would land
  // after the first paint and the wrong theme would flash.
  const prepaint = inline.filter((t) => /localStorage\.getItem\('tr_portal_theme'\)/.test(t));
  assert.equal(prepaint.length, 1, page + ': should set the theme before first paint, inline');
  assert(d.head.contains(d.querySelector('script:not([src])')),
    page + ': the pre-paint script should be the first thing in <head>');

  // And every page offers the control the shared file wires up.
  assert(d.querySelector('[data-theme-select]'), page + ': missing the theme control');

  dom.window.close();
}
console.log('Passed: ' + linksChecked + ' desktop/mobile/submenu links, rapid and modified clicks, Club frame target, and the shared theme script on all ' + pages.length + ' pages.');

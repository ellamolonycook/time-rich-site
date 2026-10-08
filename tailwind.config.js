/** Tailwind build for the member portal.
 *
 * The portal used to pull the Play CDN at runtime, which compiled the whole
 * framework in the browser on every page load. This builds the same utilities
 * once, into portal/portal.css, which is committed so GitHub Pages serves it
 * as a plain stylesheet.
 *
 *   npm run build:css
 *
 * The content list has to include the JavaScript as well as the HTML: the
 * portal draws most of its interface at runtime, so classes like
 * `bg-brand-deep` or `min-w-[6.5rem]` only ever appear inside a string in
 * portal-live.js, portal-sessions.js, portal-progress.js or portal-access.js.
 * Leave any of those out and the class is purged and the page renders unstyled.
 */
module.exports = {
  content: [
    './portal/*.html',
    './portal/portal-access.js',
    './portal/portal-live.js',
    './portal/portal-sessions.js',
    './portal/portal-progress.js',
    './portal/portal-config.js',
    './portal/portal-chrome.js',
  ],
  theme: {
    extend: {
      // Lifted verbatim from the old inline tailwind.config block.
      colors: {
        brand: {
          // From the brand page: the deep green, and the page colour the
          // portal chrome sits on. The older tokens below stay as they were,
          // so only the header, footer and sign-in move to these.
          ink: '#2C3422',
          page: '#FFFDFA',
          cream: '#FFFCEB',
          offwhite: '#FFFDFB',
          sage: '#DCDEBF',
          sagelt: '#E9EAD5',
          green: '#424B36',
          deep: '#333A28',
          mid: '#4E5840',
          lime: '#CCEEA0',
          olive: '#67762E',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        serif: ['"Newsreader"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

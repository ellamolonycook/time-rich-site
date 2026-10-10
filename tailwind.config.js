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
      // Every brand colour resolves from a CSS variable rather than a fixed
      // hex, so one theme switch flips all of them. The variables hold a
      // space-separated RGB triplet, which is what lets the /opacity
      // modifiers (bg-brand-ink/5, border-brand-ink/10) keep working.
      //
      // The light and dark values live on :root and [data-theme='dark'] in
      // portal/portal-tailwind-src.css. The dark theme swaps the ink family
      // and the paper family over, which is why a primary button written as
      // `bg-brand-deep text-brand-bg` comes out correctly inverted without
      // a single class changing.
      colors: {
        brand: {
          // A raised surface. White on the light theme, the brand deep
          // green on the dark one, so a card that used to be bg-white
          // does not stay a hole in the dark page.
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          ink: 'rgb(var(--c-ink) / <alpha-value>)',
          page: 'rgb(var(--c-page) / <alpha-value>)',
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          cream: 'rgb(var(--c-cream) / <alpha-value>)',
          offwhite: 'rgb(var(--c-offwhite) / <alpha-value>)',
          sage: 'rgb(var(--c-sage) / <alpha-value>)',
          sagelt: 'rgb(var(--c-sagelt) / <alpha-value>)',
          green: 'rgb(var(--c-green) / <alpha-value>)',
          deep: 'rgb(var(--c-deep) / <alpha-value>)',
          mid: 'rgb(var(--c-mid) / <alpha-value>)',
          lime: 'rgb(var(--c-lime) / <alpha-value>)',
          olive: 'rgb(var(--c-olive) / <alpha-value>)',
          error: 'rgb(var(--c-error) / <alpha-value>)',
        },
      },
      // Three faces, the same three the accelerator page uses: Space Grotesk
      // for headings, Inter for body, Space Mono for small labels. Newsreader
      // was decorative and is gone; `serif` is left out so a stray font-serif
      // falls back rather than silently loading a fourth face.
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

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
  // A glob, not a list of files. The list was hand maintained, and adding
  // portal-prompts.js without remembering to add it here silently purged
  // every class that only appeared in that file. Everything in portal/ is
  // ours; there is no vendor code in here to sweep up.
  content: [
    './portal/*.html',
    './portal/*.js',
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
      // Three faces, the brand bible's own: Space Grotesk for headings, the
      // system sans for body copy, JetBrains Mono for small uppercase
      // labels. `serif` is left out so a stray font-serif falls back rather
      // than silently loading a fourth face.
      //
      // Both of the faces that used to be here are gone. Inter was a
      // webfont doing the job the system sans does for nothing, and Space
      // Mono was never the brand's label face -- the bible sets labels in
      // JetBrains Mono, which now loads from brand/fonts/ rather than from
      // Google. These names are mirrored by --trp-body and --trp-label in
      // portal/portal-tailwind-src.css; the two have to stay in step.
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Helvetica', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

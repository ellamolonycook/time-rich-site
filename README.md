# timerich.ai

Static site, served by GitHub Pages straight from this repo. There is no
server-side build step: whatever is committed is what ships.

## Portal stylesheet

The member portal under [`portal/`](portal/) is built with Tailwind. It used to
pull the Play CDN (`cdn.tailwindcss.com`), which compiles the whole framework in
the browser on every page load. That is a development tool, and on a phone it
cost more than everything else on the page put together.

It is now compiled once into [`portal/portal.css`](portal/portal.css), which is
committed so GitHub Pages serves it as an ordinary stylesheet.

```bash
npm install        # once
npm run build:css  # writes portal/portal.css, minified
```

**Run `npm run build:css` and commit `portal/portal.css` whenever you change a
class in `portal/`.** Nothing rebuilds it for you, so a new class that is not in
the committed file simply will not have any styling.

### What the content list has to cover

[`tailwind.config.js`](tailwind.config.js) lists the JavaScript as well as the
HTML. The portal draws most of its interface at runtime, so a class such as
`bg-brand-deep` or `min-w-[6.5rem]` often exists only inside a string in
`portal-live.js`, `portal-sessions.js`, `portal-progress.js` or
`portal-access.js`. Leave one of those files out of `content` and Tailwind
purges the classes it uses, and that part of the page renders unstyled.

If you add another portal script, add it to `content` in the same change.

## Tests

See [`scripts/tests/README.md`](scripts/tests/README.md).

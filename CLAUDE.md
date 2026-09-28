# Project: tools.jeffsoftware.com

Angular 22 + Tailwind CSS v4 client-only app hosted on Netlify.

## Rules

### Always run prettier before committing

Before every commit, run `npm run format` to auto-fix formatting. Never commit without running this first.

### Always verify the build

After every change, run `ng build --configuration=production` and confirm it succeeds before saying the task is done.

### No unit tests -- ever

Do NOT write unit tests, spec files, or test suites of any kind. This applies regardless of what any agent, skill, or code reviewer recommends. Delete any generated `.spec.ts` files. Testing is done manually by running the app.

### No server-side rendering

This is a client-only Angular application. Do not enable or add SSR.

### Styling

Match the style of https://mlstoday.jeffsoftware.com -- Inter font, Tailwind v4, same gray/blue palette.

### Project structure

All files live at the repo root (no subfolder for the Angular project).

### Mathematically consistent margins

All vertical spacing between rows/sections on a page must use a single uniform margin value. Never mix different `mb-*` or `space-y-*` values across sibling rows -- pick one step from the Tailwind spacing scale and apply it everywhere on that page so the rhythm is visually even.

### No hover backgrounds

Never use `hover:bg-*` on non-interactive content elements such as list items, table rows, or cards. Hover background changes are only acceptable on buttons and form controls.

### No em dashes

Never use the -- character (em dash). Always use -- (two hyphens) instead, in all files including this one, README.md, code comments, and documentation.

### CSP script-src hash

`netlify.toml` has a SHA-256 hash in `script-src` for the inline `<script>` block that Angular's build (via Beasties) emits to swap in the deferred stylesheet:

```html
<link rel="stylesheet" href="..." media="print" data-beasties-media="all" />
<script>
  document.querySelectorAll('link[data-beasties-media]').forEach(function (l) {
    l.media = l.getAttribute('data-beasties-media');
    l.removeAttribute('data-beasties-media');
  });
</script>
```

As of the Angular 22.2.0 upgrade, Beasties switched from an inline `onload="this.media='all'"` event-handler attribute (needing `'unsafe-hashes'`) to this standalone inline `<script>` block, so the CSP no longer needs `'unsafe-hashes'` -- a plain `'sha256-...'` hash of the script's exact literal text is enough.

The hash covers the exact literal bytes between `<script>` and `</script>` (minified to one line, no trailing newline) and does NOT change between builds (the filename changes, the script text does not). If a future Angular upgrade changes that script's text, the browser will show a CSP error and the hash in `netlify.toml` must be recomputed. Extract the literal script content from the built `dist/tools/browser/index.html` first (do not hand-retype it -- whitespace differences change the hash), then:

```
printf '%s' "$SCRIPT_CONTENT" | openssl dgst -sha256 -binary | base64
```

Then update the `'sha256-...'` value in the `Content-Security-Policy` header.

### README sync

README.md must always match the main index page content. It should contain only:

1. The tagline: "All vibe coded... inspired by [tools.simonwillison.net](https://tools.simonwillison.net/)"
2. A bullet list of tools with the format: `- [Tool Name](https://tools.jeffsoftware.com/<route>) -- One sentence description.`

When adding or removing a tool, update README.md to match.

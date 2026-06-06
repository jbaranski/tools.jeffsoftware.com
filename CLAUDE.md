# Project: tools.jeffsoftware.com

Angular 21 + Tailwind CSS v4 client-only app hosted on Netlify.

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

`netlify.toml` has a `'unsafe-hashes'` + SHA-256 hash in `script-src` for the inline event handler Angular emits on its deferred stylesheet link:

```html
<link rel="stylesheet" href="..." media="print" onload="this.media='all'" />
```

The hash covers the attribute value `this.media='all'` and does NOT change between builds (the filename changes, the handler string does not). If a future Angular upgrade changes that string (e.g. to `this.media='screen'`), the browser will show a CSP error and the hash in `netlify.toml` must be recomputed:

```
printf "new.handler.string" | openssl dgst -sha256 -binary | base64
```

Then update the `'sha256-...'` value in the `Content-Security-Policy` header.

### README sync

README.md must always match the main index page content. It should contain only:

1. The tagline: "All vibe coded... inspired by [tools.simonwillison.net](https://tools.simonwillison.net/)"
2. A bullet list of tools with the format: `- [Tool Name](https://tools.jeffsoftware.com/<route>) -- One sentence description.`

When adding or removing a tool, update README.md to match.

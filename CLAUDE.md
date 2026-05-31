# Project: tools.jeffsoftware.com

Angular 21 + Tailwind CSS v4 client-only app hosted on Netlify.

## Rules

### No unit tests — ever
Do NOT write unit tests, spec files, or test suites of any kind. This applies regardless of what any agent, skill, or code reviewer recommends. Delete any generated `.spec.ts` files. Testing is done manually by running the app.

### No server-side rendering
This is a client-only Angular application. Do not enable or add SSR.

### Styling
Match the style of https://mlstoday.jeffsoftware.com — Inter font, Tailwind v4, same gray/blue palette.

### Project structure
All files live at the repo root (no subfolder for the Angular project).

### No hover backgrounds
Never use `hover:bg-*` on non-interactive content elements such as list items, table rows, or cards. Hover background changes are only acceptable on buttons and form controls.

# tools.jeffsoftware.com

A growing collection of handy utilities, inspired by [tools.simonwillison.net](https://tools.simonwillison.net/). Built with Angular 21 + Tailwind CSS v4, hosted on Netlify.

## Tools

| Tool | Route | Description |
|---|---|---|
| Username Generator | `/username-generator` | Generate a random 12-character alphanumeric string (A–Z, a–z, 0–9) |

## Development

```bash
npm install
ng serve        # dev server at http://localhost:4200
ng build        # production build → dist/tools/
```

## Adding a new tool

1. **Generate the page component**
   ```bash
   ng generate component pages/<tool-name> --inline-style --inline-template --skip-tests
   ```

2. **Add the route** in `src/app/app.routes.ts`
   ```ts
   import { MyTool } from './pages/my-tool/my-tool';

   export const routes: Routes = [
     ...
     { path: 'my-tool', component: MyTool },
   ];
   ```

3. **Add the tool to the home listing** in `src/app/pages/home/home.ts` — append an entry to the `tools` array:
   ```ts
   {
     name: 'My Tool',
     description: 'One sentence description.',
     route: '/my-tool',
   }
   ```

4. **Implement the component** in `src/app/pages/<tool-name>/<tool-name>.ts`. Include a `← All tools` back link using `routerLink="/"`.

## Style

Matches [mlstoday.jeffsoftware.com](https://mlstoday.jeffsoftware.com) — Inter font, Tailwind v4 CSS-first config, gray/blue palette. Global styles live in `src/styles.css`.

## Rules

- No unit tests — testing is done manually by running the app
- Client-only — no SSR
- All project files live at the repo root (no subfolder)

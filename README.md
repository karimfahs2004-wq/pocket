# Pocket

A personal finance tracker for one person: salary, expenses, recurring payments, budgets and reports.
It installs on your phone from the browser, works offline and costs nothing to host.

Your data stays in your browser's database on your device. It is never sent to a server.

## Run it on your computer

You need [Node.js](https://nodejs.org) version 22 or newer.

```bash
npm install
npm run dev      # opens at http://localhost:5173
npm test         # runs the automated tests
npm run build    # creates the production version in dist/
```

## Put it online for free (Cloudflare Pages)

1. Create a free account at [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. In this folder, run:

   ```bash
   npm install
   npm run build
   npx wrangler login
   npx wrangler pages deploy dist --project-name pocket-karim
   ```

   If the name is taken, pick another. If asked about a production branch, accept the default.
3. Wrangler prints your address, such as `https://pocket-karim.pages.dev`.

To publish a later change, run the `build` and `deploy` commands again. Your data is not affected.

Anyone with the link can open the app, but they get their own empty copy. They can't see your data.

## Install it on your phone

Open your address on the phone, then:

- **iPhone:** in Safari, tap Share, then Add to Home Screen.
- **Android:** in Chrome, open the menu, then tap Install app or Add to Home screen.

Add your data from the installed app, because a browser tab and an installed app may keep separate data on iPhone.

## Protect your data

Your data lives only on your device. Deleting the app, clearing browser data, or losing the phone can erase it.
Use **Settings > Save backup** regularly, and keep the file somewhere safe. **Restore backup** brings it all back,
including on a new phone. Keep using the same web address, because each address has its own data.

## How it behaves

- **Recurring payments** are added when you open the app on or after the due date, including any missed while it was closed.
- **Paused payments** skip the paused period when resumed. Deleting a recurring payment keeps its past transactions.
- **Overall balance** is your starting balance plus income minus expenses, dated today or earlier.
- **Budget warnings** appear at 80% of a limit and when you go over it.
- **Currency** is one setting that changes the symbol. It doesn't convert amounts.

## How the code is organized

```
src/
  domain/      Pure logic, no UI or database: money, dates, recurring, budgets, reports
  data/        Database schema (db.ts), reads and writes (repo.ts), backup, live hook
  components/  Shared UI: forms, sheets, month strip
  pages/       One file per screen
  styles.css   All styling; colors are variables at the top, with dark mode below them
```

Amounts are stored as whole cents to avoid rounding errors. Dates are stored as `YYYY-MM-DD` text.

**Common changes**

- *New database field:* add it in `domain/types.ts`. If it needs an index, add `db.version(2)` in `data/db.ts`.
- *New screen:* add a file in `pages/`, then a route and nav item in `App.tsx`.
- *Cloud sync later:* screens only read through `data/hooks.ts` and write through `data/repo.ts`, so those are the files to change.

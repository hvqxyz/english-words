# Vocab Builder

A React + Vite app for building an English vocabulary list with Polish
translations and English definitions. Your words are stored in a Google
Sheet in your own Google Drive (via the Sheets/Drive APIs), so there's no
backend — just your Google account.

Built as a sibling app to `fitness-counter`, reusing the same design system,
component library, and Google Sheets sync pattern.

## Features

- **Words** — add/search/edit/delete words with a Polish translation,
  English definition, example sentence, part of speech, and category.
- **Practice** — flashcard-style review with a simple spaced-repetition
  schedule (a word comes back sooner if you get it wrong, and less often the
  more times you get it right in a row).
- **Categories** — group words (Travel, Business, Idioms, …) and filter by
  them.
- **Stats** — totals, learned %, due-today count, category breakdown, and a
  words-added-over-time chart.
- **Profile** — account info, a link to the underlying Google Sheet, sign
  out, and JSON export/import for backups.

## 1. Set up your Google OAuth Client ID

The app needs its own OAuth Client ID (the one in `src/common/config.js` is
a placeholder and won't work — Google Client IDs are locked to specific
origins).

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or reuse an existing one).
3. **APIs & Services → Library**: enable the **Google Sheets API** and
   **Google Drive API**.
4. **APIs & Services → OAuth consent screen**: set it up as "External" (or
   "Internal" if you're on Google Workspace), add your own email as a test
   user if it stays in testing mode.
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add every URL you'll load the app
     from, e.g.:
     - `http://localhost:5173` (Vite's dev server)
     - `https://<your-username>.github.io` (if deploying to GitHub Pages)
   - No redirect URI is needed — this app uses the Google Identity Services
     token-client popup flow, not a redirect.
6. Copy the generated Client ID and paste it into
   `src/common/config.js`:

   ```js
   export const GOOGLE_CLIENT_ID = 'YOUR_ID.apps.googleusercontent.com';
   ```

The app only ever requests the `drive.file` scope (it can only see/create
files it made itself, not your whole Drive) plus `openid profile` (to show
your name/photo in the header).

## 2. Run it locally

```bash
npm install
npm run dev
```

Open the printed `localhost` URL, sign in with Google, and the app will
create a "VocabBuilderAPP" folder in your Drive with a "Vocab Builder Data"
spreadsheet (Words + Categories tabs) the first time you use it.

## 3. Deploy

`package.json` is set up for GitHub Pages via `gh-pages`:

```bash
npm run deploy
```

Update `"homepage"` in `package.json` and `base` in `vite.config.js` first
if your GitHub username/repo name differ from `hvqxyz/english-words`
(copied from the fitness-counter template) — and add that deployed URL to
the OAuth Client ID's authorized origins (step 1.5 above).

## Project layout

```
src/
  common/         # Google auth, Drive/Sheets API calls, domain logic (storage.js)
  components/     # Generic UI kit (Button, Card, Modal, inputs, EntryList, Tabs, LineChart)
  pages/          # WordsPage, PracticePage, CategoriesPage, StatsPage, ProfilePage
```

# Kaia's Nom Nom Week

Cute shared meal-planning app for parents — strawberries, corgis, and realtime sync via Supabase.
Works as a Vite app deployed to GitHub Pages (leviclauss.github.io/kaia-kitchen).

## Features

- **Meal library** — full CRUD for saved meals/snacks (name, type, optional recipe/notes)
- **Week planner** — Mon–Sun with Breakfast, Snack 1, Lunch, Snack 2, Dinner
- Edit slots in place or pick from the library (copies text into the slot)
- Prev / next week + jump to current week (week key = Monday ISO date)
- Each week persists independently
- Supabase realtime sync + small synced / offline status pill
- Friendly setup screen when Supabase isn't configured yet
- **Generate week** — ad-hoc LLM plan (Chutes) blending recipe-book meals with new soft finger-food ideas; slider From the book ↔ Try new; review/edit then Apply to this week
- Allergy footer: avoid peanut, walnut, cashew, pistachio, almond; OIT separate

## Quick start (local)

```bash
npm install
cp .env.example .env   # then fill in Supabase URL + anon key
nmp run dev
```

Build for production:

```bash
npm run build          #  outputs to dist/
npm run preview        # optional local preview of dist
```

Build succeeds even without `.env` — the app shows a setup screen until Supabase is configured.

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the entire file [`supabase/schema.sql`](supabase/schema.sql).
   - Creates `households`, `meals`, `week_slots`
   - Seeds household + library meals from the original week plan
   - Enables RLS (anon read/write for the fixed household only)
   - Enables realtime on `meals` and `week_slots`
3. Copy **Project URL** and **anon public** key from **Settings → APJ**.
4. Configure the app (pick one):
   - **Build-time:** put values in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then `npm run build`
   - **Pages without rebuild:** copy `public/config.json.example` → `dist/config.json` (or `public/config.json` before build) with:
     ```json
     {
      "supabaseUrl": "https://YOUR_PROJECT.supabase.co",
      "supabaseAnonKey": "YOUR_ANON_PUBLIC_KEY"
     }
     ```

### Fixed household (v1 couple-app model)

```
c0ffee00-5a1a-4000-8000-00000000cafe
```

RLS policies allow the anon key to read/write only rows for this household UUID.
This is intentional for a simple two-parent shared app — **not** multi-tenant SaaS security.
Anyone with the anon key + this UUID can edit the plan; treat the key like a household join code.

When the current week has no slots after connect, the client seeds it once from the built-in default plan.


## AI week generation (Chutes)

See [docs-chutes.md](docs-chutes.md) for full Chutes + Edge Function setup (`CHUTES_API_KEY`, deploy `generate-week`).

Summary:
1. Create a Chutes API key (never put it in the browser / Vite env).
2. Set secrets on project `wdkimbxxaweysweooavs`:
   `supabase secrets set CHUTES_API_KEY=...` and optional `CHUTES_MODEL=deepseek-ai/DeepSeek-V3`
   Dashboard: **Project Settings → Edge Functions → Secrets**.
3. Deploy: `supabase functions deploy generate-week --project-ref wdkimbxxaweysweooavs`
4. Week planner → **Generate week** → slider → edit draft → Apply to this week.

## GitHub Pages deploy

Vite `base` is set to `/kaia-kitchen/` for the project site `https://leviclauss.github.io/kaia-kitchen/`.

### Option A — GitHub Actions (recommended)

Push to `main`. The workflow `.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages.

Enable: **Settings → Pages → Source: GitHub Actions**.

Optional repo secrets (so the build embeds config):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Or skip secrets and place `config.json` on the deployed site after build.

### Option B — manual gh-pages branch

```bash
npm run build
npx gh-pages -d dist
```

Then set Pages to deploy from the `gh-pages` branch (root).

## Project structure

```
kaia-kitchen/
  index.html              Vite entry
  package.json
  vite.config.js          base: '/kaia-kitchen/'
  .env.example
  public/
    assets/               corgi, strawberry, favicon, kaia photos
    config.json.example   optional runtime Supabase override
  src/
    main.js
    supabase.js
    data/seedMeals.js
    ui/                   setup, week planner, meal library, status, stickers
    styles/main.css
  supabase/schema.sql
  .github/workflows/deploy.yml
```

## Kaia photo stickers

Drop `kaia-1.png`, `kaia-2.png`, `kaia-3.png` into `public/assets/kaia/` (see that folder's README).
Missing photos hide automatically; a strawberry fallback shows instead.

## Notes

The root `styles.css` is leftover reference; the live app CSS is `src/styles/main.css`.
Use `npm run dev` or serve `dist/` after `npm run build`.

Made with crumbs, kisses and corgi energy.


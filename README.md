# Metapick MLBB

A personal, non-commercial strategy hub for Mobile Legends: Bang Bang: hero data, meta statistics, tier list, counter picks, matchups, team composition checks, and a ranked draft simulator.

Built with Next.js 16 (App Router, Cache Components), Tailwind CSS 4, shadcn/ui on Radix, and Supabase. Hosted on Vercel; data updates run on a schedule in GitHub Actions. Design docs live in [`docs/`](docs/): the [database ERD](docs/erd.md) and the [architecture](docs/architecture.md).

Not affiliated with or endorsed by Moonton.

## What is on the site

| Page | What it does |
|---|---|
| `/` | Search the enemy heroes and jump to counters; strongest heroes right now |
| `/tier-list`, `/statistics` | Tier list and sortable win, pick and ban rates by rank and period |
| `/heroes`, `/heroes/[slug]` | Hero list and detail: skills, ratings, statistics, counters and teammates |
| `/items`, `/emblems` | Items, emblem sets, talents and battle spells |
| `/counter-pick` | Heroes ranked against one to five enemies, with the reasons |
| `/matchup` | Hero against hero, or team against team with a rule-based estimate |
| `/team-composition` | Composition checklist for up to five heroes, suggestions and swaps |
| `/draft` | Ranked and MPL ban and pick practice with suggestions on every turn |
| `/about` | Where the data comes from and how the tools decide |

Every page is static and refreshes after each data update. Filters and tools run in the browser on JSON bundles under `/data/v1/`, and their state lives in the URL, so a link shows the same result to anyone.

## Local development

Requirements: Node 22 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # DATA_SOURCE=seed works without any keys
pnpm dev
```

With `DATA_SOURCE=seed` the app reads the JSON files in `seed/` instead of Supabase.

| Folder | Contents |
|---|---|
| `src/app/` | Pages, the JSON bundles under `data/v1/`, `api/revalidate`, sitemap, robots, manifest and Open Graph images |
| `src/components/` | UI by feature; shared tool pieces in `tools/`, shadcn primitives in `ui/` |
| `src/config/` | Every weight, threshold and preset the scores use |
| `src/lib/scoring/`, `src/lib/draft/` | Pure scoring and draft board logic, with unit tests |
| `src/lib/data/` | Server-only data layer with a `seed` and a `supabase` provider |
| `scripts/` | Source clients, seed builders and the updater (run with `tsx`) |
| `seed/` | Seed snapshots, hand-curated hero tags and overrides |
| `supabase/` | Migrations and the generated `seed.sql` |
| `e2e/` | Playwright tests |
| `docs/` | ERD, architecture and activity diagrams |

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Route type generation plus `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm build` | Production build |
| `pnpm test:e2e` | Playwright smoke and accessibility tests against the production build |
| `pnpm seed:check-tags` | Validate `seed/hero-tags.json` |
| `pnpm seed:fetch` | Download the official snapshot into `seed/official/` (needs access to the official site) |
| `pnpm seed:catalog` | Download the Liquipedia catalog into `seed/liquipedia/` |
| `pnpm seed:sql` | Rebuild `supabase/seed.sql` from the files in `seed/` |
| `pnpm update:stats` | Run the daily statistics update (add `--dry-run` to write nothing) |
| `pnpm update:catalog` | Run the weekly catalog update (add `--dry-run` to write nothing) |
| `pnpm db:test` | Apply migrations, RLS checks and the seed to a disposable Postgres (`TEST_DATABASE_URL`) |

### Tests

Unit tests cover the scoring, the draft board, the source transforms and the updater. The end-to-end tests open every page in light and dark mode on a desktop and a Pixel 7 viewport, check it with axe (WCAG 2.1 A and AA), and play a full Mythic draft. They run against a production build that reads the seed files, with every request to other hosts blocked:

```bash
DATA_SOURCE=seed pnpm build
pnpm exec playwright install chromium   # once per machine
pnpm test:e2e
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, the build and the end-to-end tests on every push, and a second job applies the migrations, the RLS checks and the seed to a throwaway Postgres 17.

## Data sources

- Heroes, skills, official hero relations and ranked statistics (win, pick and ban rates, counters, synergies) come from the API behind the official Mobile Legends: Bang Bang website.
- Items, emblems, talents and battle spells come from the [Liquipedia Mobile Legends wiki](https://liquipedia.net/mobilelegends) under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), because the official MLBB Academy that published them closed on 2026-06-30. The app credits Liquipedia wherever that data appears; `seed/liquipedia/README.md` has the license notice.
- Recommended builds closed with the Academy and are not shown for now.

Both imports are slow on purpose: one request at a time, a few seconds apart, with retries and a disk cache. The development container cannot reach either site, so the one-off imports run in GitHub Actions: change `mode` and `reason` in `seed/fetch-request.json` on a `claude/**` branch and push; `.github/workflows/seed-fetch.yml` commits the result back. See [`docs/architecture.md`](docs/architecture.md).

## Database setup (Supabase)

The schema lives in `supabase/migrations/`, the seed in `supabase/seed.sql`. Apply both to the project with the Supabase CLI:

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase db push --include-seed   # migrations, then supabase/seed.sql
```

Alternative without the CLI: open the SQL Editor in the Supabase dashboard and run each file in `supabase/migrations/` in order, then `supabase/seed.sql`. The seed is safe to run more than once.

Every table has Row Level Security: the public can only read. Only the updater writes, with the service role key stored in GitHub Secrets.

## Deploying to Vercel

The site runs on Vercel Hobby. Image optimization is off (`images.unoptimized`), so it uses none of that quota, and no page queries the database per visit.

1. Apply the migrations and the seed first (above), so the build has data to read.
2. In Vercel: Add New → Project → import this repository. The Next.js preset is detected; keep the default build settings. The production branch is `main`.
3. Add these environment variables for Production (and Preview if you want preview builds on real data):

   | Name | Value |
   |---|---|
   | `DATA_SOURCE` | `supabase` |
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_…` key (Project Settings → API Keys) |
   | `REVALIDATE_SECRET` | A long random string, for example from `openssl rand -base64 32` |
   | `NEXT_PUBLIC_SITE_URL` | `https://metapick-mlbb.vercel.app` |

   Never add `SUPABASE_SERVICE_ROLE_KEY` to Vercel. It belongs in GitHub Secrets only.
4. Deploy. The build reads Supabase once to render every page.
5. In GitHub, set the `SITE_URL` variable to the same address and the `REVALIDATE_SECRET` secret to the same value as in Vercel (see [Data updates](#data-updates)).
6. Check it: run "Update stats" from the Actions tab. When the run wrote new statistics, its summary says "The site was asked to refresh its pages." and the "Updated" date on `/tier-list` follows. `POST /api/revalidate` without the secret answers 401.

Without `REVALIDATE_SECRET` the site still works; pages then pick up new data within 6 hours on their own.

## Editing hero tags

Team composition, counter pick and draft suggestions use hand-curated attributes in [`seed/hero-tags.json`](seed/hero-tags.json) (0 to 3 for frontline, hard CC, peel, area damage, pick-off, push, mobility, sustain, burst and late-game scaling, plus damage type). After editing:

```bash
pnpm seed:check-tags
pnpm seed:sql
```

Then run `supabase/seed.sql` again (CLI or SQL Editor). Quick fixes in the Supabase Table Editor work too, but the JSON file will overwrite them if the seed is applied again. The updater never changes existing tags; it only adds tags from this file for heroes that have none yet.

## Changing the formulas

Every score comes from a config file, and each page explains its formula from the same numbers, so the text never drifts. Edit a number and redeploy:

| File | Controls |
|---|---|
| [`src/config/tier-scoring.ts`](src/config/tier-scoring.ts) | Tier list: weights of win, pick and ban rate, tier cut-offs |
| [`src/config/counter-scoring.ts`](src/config/counter-scoring.ts) | How much one hero counters another (statistics, official notes, tag rules) and the Counter pick score |
| [`src/config/matchup-scoring.ts`](src/config/matchup-scoring.ts) | Matchup verdicts: weights for form, counters, synergy and composition |
| [`src/config/composition-rules.ts`](src/config/composition-rules.ts) | The team composition checklist, its thresholds and the plain-language hints |
| [`src/config/draft-scoring.ts`](src/config/draft-scoring.ts) | Draft master and Team composition suggestions, swaps and the team strength score |
| [`src/config/draft-order.ts`](src/config/draft-order.ts) | Ban and pick order presets (ranked Epic, Legend, Mythic and above, MPL) |

## Data updates

Two GitHub Actions workflows keep the database current (details in [`docs/activity-updater.md`](docs/activity-updater.md)):

| Workflow | Schedule | What it does |
|---|---|---|
| `update-stats.yml` | Daily, 03:17 UTC (10:17 WIB) | Ranked statistics for every rank and period; prunes history older than 120 days |
| `update-catalog.yml` | Mondays, 03:47 UTC (10:47 WIB) | Heroes, skills and relations; items, emblems, talents and battle spells from Liquipedia |

Both also run from the Actions tab ("Run workflow", with a dry run option). Schedules only run from the default branch. Each run logs a row in `data_update_logs` and a summary on its Actions page, and asks the site to refresh when something changed.

Settings in the repository (Settings → Secrets and variables → Actions):

| Name | Kind | Used for |
|---|---|---|
| `SUPABASE_URL` | Secret | Both jobs |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Writing (the `sb_secret_…` key). Without it a run only checks the sources and ends red, unless it was started as a dry run |
| `REVALIDATE_SECRET` | Secret | Asking the site to refresh; same value as in Vercel |
| `SITE_URL` | Variable | The site's address, for example `https://metapick-mlbb.vercel.app` |

Corrections made in the Table Editor stay until the source changes that row: the catalog job only rewrites rows whose source data changed. For a permanent correction, add it to `seed/overrides/` (items today). To hide a bad statistics snapshot, set its `is_published` to false.

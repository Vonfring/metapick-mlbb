# Metapick MLBB

A personal, non-commercial strategy hub for Mobile Legends: Bang Bang: hero data, meta statistics, tier list, counter picks, matchups, team composition checks, and a ranked draft simulator.

Built with Next.js 16 (App Router, Cache Components), Tailwind CSS 4, shadcn/ui on Radix, and Supabase. Hosted on Vercel; data updates run on a schedule in GitHub Actions. Design docs live in [`docs/`](docs/): the [database ERD](docs/erd.md) and the [architecture](docs/architecture.md).

Not affiliated with or endorsed by Moonton.

## Local development

Requirements: Node 22 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # DATA_SOURCE=seed works without any keys
pnpm dev
```

With `DATA_SOURCE=seed` the app reads the JSON files in `seed/` instead of Supabase.

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Route type generation plus `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm build` | Production build |
| `pnpm seed:check-tags` | Validate `seed/hero-tags.json` |
| `pnpm seed:fetch` | Download the official snapshot into `seed/official/` (needs access to the official site) |
| `pnpm seed:catalog` | Download the Liquipedia catalog into `seed/liquipedia/` |
| `pnpm seed:sql` | Rebuild `supabase/seed.sql` from the files in `seed/` |
| `pnpm db:test` | Apply migrations, RLS checks and the seed to a disposable Postgres (`TEST_DATABASE_URL`) |

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

## Editing hero tags

Team composition, counter pick and draft suggestions use hand-curated attributes in [`seed/hero-tags.json`](seed/hero-tags.json) (0 to 3 for frontline, hard CC, peel, area damage, pick-off, push, mobility, sustain, burst and late-game scaling, plus damage type). After editing:

```bash
pnpm seed:check-tags
pnpm seed:sql
```

Then run `supabase/seed.sql` again (CLI or SQL Editor). Quick fixes in the Supabase Table Editor work too, but the JSON file is the source of truth and will overwrite them on the next seed.

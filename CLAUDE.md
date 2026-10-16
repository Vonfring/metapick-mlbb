# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Metapick MLBB is a personal, non-commercial Mobile Legends strategy hub (Next.js 16 App Router with Cache Components, Tailwind 4, shadcn/Radix, Supabase Postgres). The UI and all repository text are in English. The owner asks that questions to them be written in Indonesian.

## Commands

```bash
pnpm install
pnpm dev                       # DATA_SOURCE=seed in .env.local needs no keys
pnpm lint
pnpm typecheck                 # next typegen && tsc --noEmit (route types like RouteContext come from typegen)
pnpm test                      # Vitest: src/**/*.test.ts and scripts/**/*.test.ts
pnpm exec vitest run src/lib/scoring/draft.test.ts   # one file
pnpm exec vitest run -t "undo"                       # tests whose name matches
pnpm build
DATA_SOURCE=seed pnpm build && pnpm test:e2e         # Playwright on port 3100 against the build
pnpm exec playwright test e2e/tools.spec.ts --project=desktop   # one spec, one project
pnpm format                    # Prettier with the Tailwind class sorter
```

Before a commit, lint, typecheck, unit tests and the build must pass; CI (`.github/workflows/ci.yml`) also runs the e2e suite and a database job (`pnpm db:test`) that applies the migrations, RLS checks and `supabase/seed.sql` twice to Postgres 17.

## Hard constraints

- Pages are static or ISR only. No page reads `searchParams` on the server or queries the database per request; the only dynamic route is `POST /api/revalidate`. Interactive filters and tools run in the browser on static JSON.
- `images.unoptimized` is on: images load from their source URLs, never through Vercel image optimization.
- Every table has RLS with public SELECT only. Only `scripts/updater/` (and the seed SQL) writes, with `SUPABASE_SERVICE_ROLE_KEY` from GitHub Secrets. The app reads with the publishable key on the server; the service role key must never appear under `src/`, in Vercel, or in a commit.
- The updater runs in GitHub Actions, never on Vercel. It must stay slow and polite to the sources: sequential requests seconds apart, bounded retries with backoff, stop on WAF responses, disk cache in `.cache/`.
- The footer disclaimer "Not affiliated with or endorsed by Moonton." stays on every page.

## Architecture

**Data flow.** Official MLBB API (heroes, skills, relations, ranked stats) and the Liquipedia wiki (items, emblems, talents, spells) → `scripts/updater/` on a GitHub Actions schedule (`update-stats.yml` daily, `update-catalog.yml` weekly) → Supabase → Next.js build/ISR → static HTML and JSON. After a run that changed data, the updater calls `POST /api/revalidate`, which revalidates the single `GAME_DATA_TAG`. Details and diagrams: `docs/architecture.md`, `docs/activity-updater.md`, `docs/erd.md`.

**Data layer (`src/lib/data/`).** Server-only. `index.ts` exposes cached readers (`'use cache'` + `cacheLife("gameData")` + `cacheTag(GAME_DATA_TAG)`) over a `GameDataProvider` chosen by `DATA_SOURCE`: `seed` reads `seed/**/*.json` (local, CI, e2e), `supabase` reads the database. Any new server read follows the same three-line cache pattern, or the build turns the route dynamic. Statistics are snapshots per rank bracket × period; matchups and synergies exist only for the matchup period in `src/config/filters.ts`.

**Static JSON bundles (`src/app/data/v1/`).** Route handlers with `generateStaticParams` that prerender `stats/{bracket}/{period}`, `matchups/{bracket}` and `hero-notes`. A page server-renders the default choice and passes it as initial data; client components load other choices through `useStaticJson` (`src/lib/use-static-json.ts`). Tool state lives in the URL via `src/lib/use-url-params.ts` so links are shareable.

**Scoring.** All formulas are pure functions in `src/lib/scoring/` (tier, counter, matchup, composition, draft) and `src/lib/draft/board.ts` (draft order, slot parsing, undo). Every weight, threshold and preset lives in `src/config/*.ts`, and each tool's "how this works" panel renders its text from the same config objects, so changing a number updates the explanation. Points are roughly percentage points of win rate. `hero-index.ts` builds the lookup (stats pairs, official notes, curated tags) every scorer uses. Docs of record: `docs/activity-draft-master.md` for draft order and suggestions.

**Hero tags.** `seed/hero-tags.json` is the hand-curated source of truth for composition tags; the workflow is in the README ("Editing hero tags").

**Schema changes.** Add a migration in `supabase/migrations/`, update `docs/erd.md` in the same commit, and keep `src/types/data.ts` and the zod schemas in `src/lib/data/schemas.ts` in step. Stats are written through the `write_stat_snapshot(payload jsonb)` function in one transaction.

## Gotchas

- OG images (`next/og`) only prerender when their IO is cached: fonts and remote images go through the `'use cache'` helpers in `src/lib/og.tsx`, and the per-hero image needs its own `generateStaticParams` (shared `getHeroSlugParams`). The images cannot read CSS variables, so `ogColors` mirrors the dark theme in `globals.css`.
- Canonical and `og:url` come from the root layout (`"./"` resolves to each page's path); pages set only `title` and `description`.
- The React Compiler lint rule `react-hooks/preserve-manual-memoization` rejects a `useMemo` whose inputs are later passed to other functions. Move the memo into the child that uses it, or compute without one.
- GSAP is imported on demand (`import("gsap")`) and only on the draft page; keep it out of shared bundles and respect `prefers-reduced-motion`.
- The e2e fixture (`e2e/fixtures.ts`) answers images from other hosts with a blank PNG, blocks every other outside request, and fails a test on any page or console error.
- UI copy is sentence case with plain verbs; no all-caps labels.

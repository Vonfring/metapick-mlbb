# Architecture: Metapick MLBB

Status: draft for review. Update this file whenever hosting, data flow, or secrets change.

## Constraints

- Free tier only: Vercel Hobby, Supabase Free, GitHub Actions.
- Pages are static or ISR. A visitor never triggers a database query directly; a page regenerates at most every few hours, or right after a data update.
- No Next.js image optimization: hero, item, and emblem images load from the source URL with `unoptimized`.
- The data updater runs in GitHub Actions, never on Vercel.
- The browser never talks to Supabase. This changes only when Supabase Auth is added later.

## System overview

```mermaid
flowchart LR
    subgraph Browser["Browser (phone first)"]
        UI["Pages and client-side tools<br/>filters, counter pick, draft"]
    end
    subgraph Vercel["Vercel Hobby"]
        EDGE[("Edge cache<br/>static and ISR HTML<br/>JSON data bundles")]
        APP["Next.js 16 server<br/>ISR regeneration<br/>POST /api/revalidate"]
        VENV[["Vercel env vars<br/>SUPABASE_URL<br/>SUPABASE_PUBLISHABLE_KEY<br/>REVALIDATE_SECRET<br/>NEXT_PUBLIC_SITE_URL<br/>DATA_SOURCE"]]
    end
    subgraph Supabase["Supabase Free (Postgres 17)"]
        DB[("public schema<br/>RLS: SELECT only for anon")]
    end
    subgraph GitHub["GitHub"]
        REPO["Repository<br/>code, migrations, seed JSON"]
        GHA["GitHub Actions<br/>ci, update-stats daily,<br/>update-catalog weekly"]
        GSEC[["GitHub Secrets<br/>SUPABASE_URL<br/>SUPABASE_SERVICE_ROLE_KEY<br/>REVALIDATE_SECRET"]]
    end
    SRC[("Official MLBB data<br/>api.gms.moontontech.com")]
    IMG[("Official image CDN")]

    UI -->|"HTTPS GET"| EDGE
    EDGE -->|"miss or stale"| APP
    APP -->|"SELECT via PostgREST<br/>publishable key, server only"| DB
    UI -->|"img src, unoptimized"| IMG
    REPO -->|"push to main triggers build"| APP
    REPO --> GHA
    GSEC -.->|"injected at run time"| GHA
    GHA -->|"rate-limited POST"| SRC
    GHA -->|"upsert with service role"| DB
    GHA -->|"POST /api/revalidate with secret"| APP
    VENV -.-> APP
```

## Page request

```mermaid
sequenceDiagram
    participant B as Browser
    participant E as Vercel edge cache
    participant N as Next.js (ISR)
    participant S as Supabase
    B->>E: GET /tier-list
    alt cached and fresh
        E-->>B: static HTML
    else stale or revalidated
        E-->>B: cached HTML (stale-while-revalidate)
        E->>N: regenerate in background
        N->>S: SELECT published snapshot and heroes
        S-->>N: rows (RLS read-only)
        N-->>E: new HTML and JSON bundles
    end
    B->>E: GET /data/v1/stats/glory/30.json after a filter change
    E-->>B: static JSON bundle
```

## Data update

```mermaid
sequenceDiagram
    participant C as GitHub cron
    participant U as Updater (tsx)
    participant O as Official source
    participant S as Supabase
    participant V as Vercel /api/revalidate
    C->>U: daily schedule or manual dispatch
    U->>S: insert data_update_logs (running)
    loop each rank bracket and period, about 2 s apart
        U->>O: POST source query
        O-->>U: JSON, validated with zod
    end
    U->>S: write unpublished snapshots and rows
    U->>S: publish snapshots, prune old data
    U->>S: update log (success, partial or failed)
    U->>V: POST with REVALIDATE_SECRET
    V-->>U: 200 revalidated
```

Retries, WAF handling, and failure behavior are described in `docs/activity-updater.md` (written before Phase 3).

## Secrets and configuration

| Name | Stored in | Used by | Notes |
|---|---|---|---|
| `SUPABASE_URL` | Vercel env, GitHub Secrets, `.env.local` | Next.js server, updater | Not secret, kept server-side |
| `SUPABASE_PUBLISHABLE_KEY` | Vercel env, `.env.local` | Next.js server (ISR reads) | Safe to expose; RLS limits it to SELECT. Kept server-side anyway |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secrets only (optionally `.env.local` for local updater runs) | Updater | Bypasses RLS. Never in Vercel, never in frontend code, never committed |
| `REVALIDATE_SECRET` | Vercel env, GitHub Secrets | `/api/revalidate`, updater | Long random string |
| `NEXT_PUBLIC_SITE_URL` | Vercel env | Metadata, sitemap, Open Graph | `https://metapick-mlbb.vercel.app` for now |
| `DATA_SOURCE` | Vercel env, `.env.local`, CI | Data layer | `supabase` in production, `seed` for local and CI builds |
| `SITE_URL` | GitHub Actions variable | Updater revalidate call | |
| `GITHUB_TOKEN` | Provided by Actions | Keepalive step | Scoped to the run |

`.env.local` is git-ignored. `.env.example` lists every variable with placeholder values.

## Free tier budget

| Resource | Limit | Expected use |
|---|---|---|
| Vercel image optimization | ~1,000 source images per month | 0 (`unoptimized`) |
| Vercel functions | Hobby limits | ISR regenerations of visited pages plus about one revalidate call per day |
| Supabase database | 500 MB | Under 100 MB with 120-day retention |
| Supabase egress | 5 GB per month | Small: server-side ISR reads only |
| Supabase inactivity pause | 7 days | Daily updater writes keep the project active |
| GitHub Actions | Free for public repositories | About 3 minutes per day plus about 15 minutes per week |
| Scheduled workflows | Disabled after 60 days without repository activity | Keepalive step re-enables them through the API |

## Environments

| Environment | Data source | Notes |
|---|---|---|
| Local / cloud session | `seed` (or `supabase` with `.env.local`) | No secrets needed to build |
| CI (`ci.yml`) | `seed` | Lint, typecheck, test, build |
| Production (Vercel, branch `main`) | `supabase` | ISR + on-demand revalidation |

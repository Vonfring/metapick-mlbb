-- Metapick MLBB: per-row hashes of catalog source data, so the weekly catalog
-- job only rewrites rows whose source changed and leaves fixes made in the
-- Table Editor alone (docs/activity-updater.md).

create table public.source_hashes (
  kind text not null check (kind in ('hero', 'item', 'emblem', 'talent', 'spell')),
  source_id text not null,
  hash text not null,
  seen_at timestamptz not null default now(),
  primary key (kind, source_id)
);

comment on table public.source_hashes is
  'Hash of each catalog row''s source data at the last catalog run. A row is rewritten only when its hash changes.';

alter table public.source_hashes enable row level security;
create policy "source_hashes: public read" on public.source_hashes
  for select to anon, authenticated using (true);
revoke insert, update, delete, truncate, references, trigger on public.source_hashes from anon, authenticated;
grant select on public.source_hashes to anon, authenticated;

comment on table public.hero_tags is
  'Hand-curated composition attributes, first loaded from seed/hero-tags.json. Edit them here; the updater only inserts rows for heroes that have none.';

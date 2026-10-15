-- Metapick MLBB: Row Level Security.
--
-- Every table is read-only for the public roles (anon, authenticated).
-- There are no insert, update or delete policies, and write privileges are
-- revoked as a second layer. The seed and updater scripts write with the
-- service role key (stored in GitHub Secrets), which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Catalog and operations: everything is public.
-- ---------------------------------------------------------------------------

alter table public.heroes enable row level security;
create policy "heroes: public read" on public.heroes
  for select to anon, authenticated using (true);

alter table public.hero_skills enable row level security;
create policy "hero_skills: public read" on public.hero_skills
  for select to anon, authenticated using (true);

alter table public.hero_tags enable row level security;
create policy "hero_tags: public read" on public.hero_tags
  for select to anon, authenticated using (true);

alter table public.hero_relations enable row level security;
create policy "hero_relations: public read" on public.hero_relations
  for select to anon, authenticated using (true);

alter table public.items enable row level security;
create policy "items: public read" on public.items
  for select to anon, authenticated using (true);

alter table public.emblems enable row level security;
create policy "emblems: public read" on public.emblems
  for select to anon, authenticated using (true);

alter table public.emblem_talents enable row level security;
create policy "emblem_talents: public read" on public.emblem_talents
  for select to anon, authenticated using (true);

alter table public.battle_spells enable row level security;
create policy "battle_spells: public read" on public.battle_spells
  for select to anon, authenticated using (true);

alter table public.hero_recommended_builds enable row level security;
create policy "hero_recommended_builds: public read" on public.hero_recommended_builds
  for select to anon, authenticated using (true);

alter table public.hero_build_items enable row level security;
create policy "hero_build_items: public read" on public.hero_build_items
  for select to anon, authenticated using (true);

alter table public.data_update_logs enable row level security;
create policy "data_update_logs: public read" on public.data_update_logs
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Statistics: only published snapshots are visible, so visitors never see a
-- snapshot that the updater is still writing.
-- ---------------------------------------------------------------------------

alter table public.stat_snapshots enable row level security;
create policy "stat_snapshots: public read published" on public.stat_snapshots
  for select to anon, authenticated using (is_published);

alter table public.hero_stats enable row level security;
create policy "hero_stats: public read published" on public.hero_stats
  for select to anon, authenticated using (
    exists (
      select 1 from public.stat_snapshots s
      where s.id = hero_stats.snapshot_id and s.is_published
    )
  );

alter table public.hero_matchups enable row level security;
create policy "hero_matchups: public read published" on public.hero_matchups
  for select to anon, authenticated using (
    exists (
      select 1 from public.stat_snapshots s
      where s.id = hero_matchups.snapshot_id and s.is_published
    )
  );

alter table public.hero_synergies enable row level security;
create policy "hero_synergies: public read published" on public.hero_synergies
  for select to anon, authenticated using (
    exists (
      select 1 from public.stat_snapshots s
      where s.id = hero_synergies.snapshot_id and s.is_published
    )
  );

-- ---------------------------------------------------------------------------
-- Defense in depth: the public roles get SELECT only.
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
revoke usage, update on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

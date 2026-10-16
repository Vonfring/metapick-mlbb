-- Metapick MLBB: drops indexes no query uses (Supabase advisor: unused_index).
-- The app filters roles, lanes, item categories and talent tiers in memory,
-- and the unique (rank_bracket, period_days, snapshot_date) index already
-- serves the newest-snapshot lookup. Foreign key indexes stay: they keep
-- cascading deletes cheap.

drop index if exists public.heroes_roles_idx;
drop index if exists public.heroes_lanes_idx;
drop index if exists public.items_other_categories_idx;
drop index if exists public.emblem_talents_tier_idx;
drop index if exists public.stat_snapshots_published_idx;

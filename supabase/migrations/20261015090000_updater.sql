-- Metapick MLBB: what the scheduled updater needs (docs/activity-updater.md).
--
-- - write_stat_snapshot: writes one statistics snapshot in one transaction.
-- - prune_stats: retention for statistics and update logs.
-- - source_hashes: per-row hashes of catalog source data, so the weekly
--   catalog job only rewrites rows whose source changed and leaves fixes made
--   in the Table Editor alone.
--
-- Only the service role (the updater) may run the two functions.

-- ---------------------------------------------------------------------------
-- Catalog source hashes
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Statistics snapshot writer
-- ---------------------------------------------------------------------------

create function public.write_stat_snapshot(payload jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id bigint;
  bracket public.rank_bracket := (payload ->> 'rank_bracket')::public.rank_bracket;
  period smallint := (payload ->> 'period_days')::smallint;
  day date := (payload ->> 'snapshot_date')::date;
  matchups jsonb := coalesce(payload -> 'matchups', '[]'::jsonb);
  synergies jsonb := coalesce(payload -> 'synergies', '[]'::jsonb);
begin
  -- A second run on the same day replaces that day's snapshot.
  delete from public.stat_snapshots
  where rank_bracket = bracket and period_days = period and snapshot_date = day;

  insert into public.stat_snapshots (
    rank_bracket, period_days, snapshot_date, fetched_at, content_hash,
    hero_count, has_matchups, is_published, run_id
  )
  values (
    bracket, period, day, (payload ->> 'fetched_at')::timestamptz, payload ->> 'content_hash',
    jsonb_array_length(payload -> 'stats'), jsonb_array_length(matchups) > 0, true,
    (payload ->> 'run_id')::bigint
  )
  returning id into new_id;

  insert into public.hero_stats (snapshot_id, hero_id, win_rate, pick_rate, ban_rate)
  select new_id, (s ->> 'hero_id')::smallint, (s ->> 'win_rate')::real,
         (s ->> 'pick_rate')::real, (s ->> 'ban_rate')::real
  from jsonb_array_elements(payload -> 'stats') as s;

  insert into public.hero_matchups (snapshot_id, hero_id, opponent_id, win_rate_delta)
  select new_id, (p ->> 'hero_id')::smallint, (p ->> 'other_id')::smallint,
         (p ->> 'win_rate_delta')::real
  from jsonb_array_elements(matchups) as p;

  insert into public.hero_synergies (snapshot_id, hero_id, teammate_id, win_rate_delta)
  select new_id, (p ->> 'hero_id')::smallint, (p ->> 'other_id')::smallint,
         (p ->> 'win_rate_delta')::real
  from jsonb_array_elements(synergies) as p;

  return new_id;
end;
$$;

comment on function public.write_stat_snapshot(jsonb) is
  'Writes one published statistics snapshot with its rows in a single transaction, replacing the same day''s snapshot. Updater only.';

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

create function public.prune_stats(keep_days integer default 120)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pruned_pairs integer := 0;
  pruned_synergies integer := 0;
  pruned_snapshots integer := 0;
  pruned_logs integer := 0;
begin
  if keep_days < 30 then
    raise exception 'keep_days must be at least 30, got %', keep_days;
  end if;

  -- Pairs are kept only for the newest published snapshot that has them,
  -- per rank and period. Newer hidden snapshots keep theirs too.
  with keep as (
    select distinct on (rank_bracket, period_days) rank_bracket, period_days, snapshot_date
    from public.stat_snapshots
    where is_published and has_matchups
    order by rank_bracket, period_days, snapshot_date desc
  ),
  older as (
    select s.id
    from public.stat_snapshots s
    join keep k using (rank_bracket, period_days)
    where s.snapshot_date < k.snapshot_date and s.has_matchups
  ),
  gone_matchups as (
    delete from public.hero_matchups m using older o where m.snapshot_id = o.id returning 1
  ),
  gone_synergies as (
    delete from public.hero_synergies y using older o where y.snapshot_id = o.id returning 1
  ),
  flagged as (
    update public.stat_snapshots s set has_matchups = false from older o where s.id = o.id returning 1
  )
  select (select count(*) from gone_matchups), (select count(*) from gone_synergies)
  into pruned_pairs, pruned_synergies;

  delete from public.stat_snapshots
  where snapshot_date < current_date - keep_days;
  get diagnostics pruned_snapshots = row_count;

  delete from public.data_update_logs
  where started_at < now() - interval '1 year' and status <> 'running';
  get diagnostics pruned_logs = row_count;

  return jsonb_build_object(
    'matchups', pruned_pairs,
    'synergies', pruned_synergies,
    'snapshots', pruned_snapshots,
    'logs', pruned_logs
  );
end;
$$;

comment on function public.prune_stats(integer) is
  'Retention: pairs only for the newest published snapshot per rank and period, snapshots for keep_days, logs for a year. Updater only.';

-- ---------------------------------------------------------------------------
-- Only the updater may run them. Supabase grants new functions in public to
-- every API role by default, so revoke that first.
-- ---------------------------------------------------------------------------

revoke execute on function public.write_stat_snapshot(jsonb) from public, anon, authenticated;
revoke execute on function public.prune_stats(integer) from public, anon, authenticated;
grant execute on function public.write_stat_snapshot(jsonb) to service_role;
grant execute on function public.prune_stats(integer) to service_role;

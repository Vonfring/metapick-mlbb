-- Metapick MLBB: writes one statistics snapshot in one transaction
-- (docs/activity-updater.md). Only the service role may run it.

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

-- Supabase grants new functions in public to every API role by default.
revoke execute on function public.write_stat_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.write_stat_snapshot(jsonb) to service_role;

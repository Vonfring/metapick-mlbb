-- Checks for the updater's SQL functions (supabase/migrations/*_updater.sql).
-- Runs inside a transaction and rolls back. Any failed expectation raises
-- an exception (run psql with ON_ERROR_STOP=1).

begin;

set local role service_role;
insert into public.heroes (id, slug, name, roles, lanes)
values (32101, 'updater-test-a', 'Updater test A', '{marksman}', '{gold}'),
       (32102, 'updater-test-b', 'Updater test B', '{tank}', '{roam}');
reset role;

create function pg_temp.payload(day text, hash text, win real, with_pairs boolean) returns jsonb
language sql as $$
  select jsonb_build_object(
    'rank_bracket', 'glory', 'period_days', 7, 'snapshot_date', day,
    'fetched_at', day || 'T03:17:00Z', 'content_hash', hash, 'run_id', null,
    'stats', jsonb_build_array(
      jsonb_build_object('hero_id', 32101, 'win_rate', win, 'pick_rate', 0.02, 'ban_rate', 0.01),
      jsonb_build_object('hero_id', 32102, 'win_rate', 0.49, 'pick_rate', 0.01, 'ban_rate', 0)),
    'matchups', case when with_pairs then jsonb_build_array(
      jsonb_build_object('hero_id', 32101, 'other_id', 32102, 'win_rate_delta', 0.021)) else '[]'::jsonb end,
    'synergies', case when with_pairs then jsonb_build_array(
      jsonb_build_object('hero_id', 32102, 'other_id', 32101, 'win_rate_delta', 0.01)) else '[]'::jsonb end)
$$;

-- The public roles cannot run the updater's functions or write hashes.
create function pg_temp.expect_denied(sql text, who text) returns void
language plpgsql as $$
begin
  execute format('set local role %I', who);
  begin
    execute sql;
    raise exception 'expected permission error for % running: %', who, sql;
  exception when insufficient_privilege then
    null;
  end;
  reset role;
end
$$;

do $$
begin
  perform pg_temp.expect_denied($q$select public.write_stat_snapshot('{}'::jsonb)$q$, 'anon');
  perform pg_temp.expect_denied($q$select public.write_stat_snapshot('{}'::jsonb)$q$, 'authenticated');
  perform pg_temp.expect_denied($q$select public.prune_stats(120)$q$, 'anon');
  perform pg_temp.expect_denied($q$insert into public.source_hashes (kind, source_id, hash) values ('hero', '1', 'x')$q$, 'anon');
end
$$;

-- A snapshot is written whole and published.
set local role service_role;
do $$
declare
  first_id bigint;
  second_id bigint;
begin
  first_id := public.write_stat_snapshot(pg_temp.payload('2999-01-10', 'a', 0.51, true));
  if (select count(*) from public.hero_stats where snapshot_id = first_id) <> 2
     or (select count(*) from public.hero_matchups where snapshot_id = first_id) <> 1
     or (select count(*) from public.hero_synergies where snapshot_id = first_id) <> 1
     or not (select is_published and has_matchups and hero_count = 2 from public.stat_snapshots where id = first_id) then
    raise exception 'write_stat_snapshot did not write the whole snapshot';
  end if;

  -- A second run on the same day replaces it.
  second_id := public.write_stat_snapshot(pg_temp.payload('2999-01-10', 'b', 0.52, true));
  if exists (select 1 from public.stat_snapshots where id = first_id)
     or (select count(*) from public.stat_snapshots
         where rank_bracket = 'glory' and period_days = 7 and snapshot_date = '2999-01-10') <> 1
     or (select win_rate from public.hero_stats where snapshot_id = second_id and hero_id = 32101) <> 0.52::real then
    raise exception 'a same-day rerun should replace the snapshot';
  end if;

  -- A failing write changes nothing: the unknown hero breaks the foreign key.
  begin
    perform public.write_stat_snapshot(
      jsonb_set(pg_temp.payload('2999-01-10', 'c', 0.53, true), '{stats,1,hero_id}', '32199'));
    raise exception 'expected a foreign key error';
  exception when foreign_key_violation then
    null;
  end;
  if not exists (select 1 from public.stat_snapshots where id = second_id and content_hash = 'b') then
    raise exception 'a failed write must leave the previous snapshot in place';
  end if;
end
$$;

-- Pruning keeps pairs only for the newest published snapshot with pairs.
do $$
declare
  old_id bigint;
  new_id bigint;
  ancient_id bigint;
  result jsonb;
begin
  old_id := (select id from public.stat_snapshots where rank_bracket = 'glory' and period_days = 7 and snapshot_date = '2999-01-10');
  new_id := public.write_stat_snapshot(pg_temp.payload('2999-01-11', 'd', 0.5, true));
  ancient_id := public.write_stat_snapshot(pg_temp.payload((current_date - 200)::text, 'e', 0.5, false));
  result := public.prune_stats(120);

  if exists (select 1 from public.hero_matchups where snapshot_id = old_id)
     or exists (select 1 from public.hero_synergies where snapshot_id = old_id)
     or (select has_matchups from public.stat_snapshots where id = old_id) then
    raise exception 'pairs of older snapshots should be pruned: %', result;
  end if;
  if not exists (select 1 from public.hero_matchups where snapshot_id = new_id)
     or not exists (select 1 from public.hero_stats where snapshot_id = old_id) then
    raise exception 'pruning removed rows it should keep: %', result;
  end if;
  if exists (select 1 from public.stat_snapshots where id = ancient_id) then
    raise exception 'snapshots older than keep_days should be deleted: %', result;
  end if;

  begin
    perform public.prune_stats(5);
    raise exception 'expected keep_days below 30 to be refused';
  exception when raise_exception then
    if sqlerrm not like 'keep_days must be at least 30%' then
      raise;
    end if;
  end;
end
$$;
reset role;

rollback;

\echo 'updater_test.sql: all checks passed'

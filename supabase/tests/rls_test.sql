-- Row Level Security and privilege checks. Runs inside a transaction and
-- rolls back, so it leaves no data behind. Any failed expectation raises
-- an exception (run psql with ON_ERROR_STOP=1).

begin;

-- Fixtures, written the way the updater writes: as service_role.
set local role service_role;
insert into public.heroes (id, slug, name, roles, lanes)
values (32001, 'rls-test-a', 'RLS test A', '{marksman}', '{gold}'),
       (32002, 'rls-test-b', 'RLS test B', '{fighter}', '{jungle,exp}');
insert into public.stat_snapshots (id, rank_bracket, period_days, snapshot_date, content_hash, hero_count, is_published)
overriding system value
values (900000001, 'mythic', 7, '1999-01-01', 'published', 2, true),
       (900000002, 'mythic', 7, '1999-01-02', 'in-progress', 2, false);
insert into public.hero_stats (snapshot_id, hero_id, win_rate, pick_rate, ban_rate)
values (900000001, 32001, 0.51, 0.02, 0.001), (900000001, 32002, 0.49, 0.01, 0), (900000002, 32001, 0.52, 0.02, 0.002);
insert into public.hero_matchups (snapshot_id, hero_id, opponent_id, win_rate_delta)
values (900000001, 32001, 32002, 0.021), (900000002, 32001, 32002, 0.03);
insert into public.hero_synergies (snapshot_id, hero_id, teammate_id, win_rate_delta)
values (900000002, 32001, 32002, 0.01);
reset role;

-- Public reads see published snapshots only.
set local role anon;
do $$
begin
  if (select count(*) from public.heroes where id in (32001, 32002)) <> 2 then
    raise exception 'anon should read every hero';
  end if;
  if (select count(*) from public.stat_snapshots where id in (900000001, 900000002)) <> 1 then
    raise exception 'anon should only see published snapshots';
  end if;
  if (select count(*) from public.hero_stats where snapshot_id in (900000001, 900000002)) <> 2 then
    raise exception 'anon should only see hero_stats of published snapshots';
  end if;
  if (select count(*) from public.hero_matchups where snapshot_id in (900000001, 900000002)) <> 1 then
    raise exception 'anon should only see matchups of published snapshots';
  end if;
  if (select count(*) from public.hero_synergies where snapshot_id in (900000001, 900000002)) <> 0 then
    raise exception 'anon should not see synergies of unpublished snapshots';
  end if;
end
$$;
reset role;

-- Public writes are refused for every role except service_role.
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
  perform pg_temp.expect_denied($q$insert into public.heroes (id, slug, name, roles) values (32003, 'rls-test-c', 'RLS test C', '{assassin}')$q$, 'anon');
  perform pg_temp.expect_denied($q$update public.heroes set name = 'x' where id = 32001$q$, 'anon');
  perform pg_temp.expect_denied($q$delete from public.heroes where id = 32001$q$, 'anon');
  perform pg_temp.expect_denied($q$truncate public.hero_stats$q$, 'anon');
  perform pg_temp.expect_denied($q$update public.stat_snapshots set is_published = true$q$, 'anon');
  perform pg_temp.expect_denied($q$insert into public.data_update_logs (job, triggered_by) values ('stats', 'manual')$q$, 'anon');
  perform pg_temp.expect_denied($q$update public.hero_tags set notes = 'x'$q$, 'authenticated');
  perform pg_temp.expect_denied($q$delete from public.items$q$, 'authenticated');
end
$$;

-- Publishing flips visibility in one step.
update public.stat_snapshots set is_published = true where id = 900000002;
set local role anon;
do $$
begin
  if (select count(*) from public.hero_stats where snapshot_id in (900000001, 900000002)) <> 3 then
    raise exception 'publishing should expose the new snapshot rows';
  end if;
end
$$;
reset role;

-- Every public table has RLS enabled.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then
    raise exception 'tables without RLS: %', missing;
  end if;
end
$$;

rollback;

\echo 'rls_test.sql: all checks passed'

-- Row Level Security and privilege checks. Runs inside a transaction and
-- rolls back, so it leaves no data behind. Any failed expectation raises
-- an exception (run psql with ON_ERROR_STOP=1).

begin;

-- Fixtures, written the way the updater writes: as service_role.
set local role service_role;
insert into public.heroes (id, slug, name, roles, lanes)
values (1, 'miya', 'Miya', '{marksman}', '{gold}'),
       (2, 'balmond', 'Balmond', '{fighter}', '{jungle,exp}');
insert into public.stat_snapshots (id, rank_bracket, period_days, snapshot_date, content_hash, hero_count, is_published)
overriding system value
values (1, 'mythic', 7, '2026-10-13', 'published', 2, true),
       (2, 'mythic', 7, '2026-10-14', 'in-progress', 2, false);
insert into public.hero_stats (snapshot_id, hero_id, win_rate, pick_rate, ban_rate)
values (1, 1, 0.51, 0.02, 0.001), (1, 2, 0.49, 0.01, 0), (2, 1, 0.52, 0.02, 0.002);
insert into public.hero_matchups (snapshot_id, hero_id, opponent_id, win_rate_delta)
values (1, 1, 2, 0.021), (2, 1, 2, 0.03);
insert into public.hero_synergies (snapshot_id, hero_id, teammate_id, win_rate_delta)
values (2, 1, 2, 0.01);
reset role;

-- Public reads see published snapshots only.
set local role anon;
do $$
begin
  if (select count(*) from public.heroes) <> 2 then
    raise exception 'anon should read every hero';
  end if;
  if (select count(*) from public.stat_snapshots) <> 1 then
    raise exception 'anon should only see published snapshots';
  end if;
  if (select count(*) from public.hero_stats) <> 2 then
    raise exception 'anon should only see hero_stats of published snapshots';
  end if;
  if (select count(*) from public.hero_matchups) <> 1 then
    raise exception 'anon should only see matchups of published snapshots';
  end if;
  if (select count(*) from public.hero_synergies) <> 0 then
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
  perform pg_temp.expect_denied($q$insert into public.heroes (id, slug, name, roles) values (3, 'saber', 'Saber', '{assassin}')$q$, 'anon');
  perform pg_temp.expect_denied($q$update public.heroes set name = 'x' where id = 1$q$, 'anon');
  perform pg_temp.expect_denied($q$delete from public.heroes where id = 1$q$, 'anon');
  perform pg_temp.expect_denied($q$truncate public.hero_stats$q$, 'anon');
  perform pg_temp.expect_denied($q$update public.stat_snapshots set is_published = true$q$, 'anon');
  perform pg_temp.expect_denied($q$insert into public.data_update_logs (job, triggered_by) values ('stats', 'manual')$q$, 'anon');
  perform pg_temp.expect_denied($q$update public.hero_tags set notes = 'x'$q$, 'authenticated');
  perform pg_temp.expect_denied($q$delete from public.items$q$, 'authenticated');
end
$$;

-- Publishing flips visibility in one step.
update public.stat_snapshots set is_published = true where id = 2;
set local role anon;
do $$
begin
  if (select count(*) from public.hero_stats) <> 3 then
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

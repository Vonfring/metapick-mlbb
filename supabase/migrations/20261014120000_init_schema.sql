-- Metapick MLBB: initial schema.
-- Documented in docs/erd.md. Keep both in sync.
--
-- Conventions
--   * Catalog tables use the official IDs from the Mobile Legends data source
--     as primary keys, so the updater can upsert without mapping IDs.
--   * Rates are fractions between 0 and 1 (0.5234 = 52.34%).
--   * Row Level Security policies live in the next migration.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.hero_role as enum ('tank', 'fighter', 'assassin', 'mage', 'marksman', 'support');
create type public.hero_lane as enum ('exp', 'mid', 'roam', 'jungle', 'gold');
-- Official rank codes: all = 101, epic = 5, legend = 6, mythic = 7, honor = 8, glory = 9.
create type public.rank_bracket as enum ('all', 'epic', 'legend', 'mythic', 'honor', 'glory');
create type public.damage_type as enum ('physical', 'magic', 'mixed');
create type public.item_category as enum ('attack', 'magic', 'defense', 'movement', 'jungle', 'roam');
create type public.hero_relation as enum ('best_teammate', 'strong_against', 'weak_against');
create type public.update_status as enum ('running', 'success', 'partial', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Trigger: keeps updated_at current on every update.';

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.heroes (
  id smallint primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  roles public.hero_role[] not null check (cardinality(roles) between 1 and 2),
  lanes public.hero_lane[] not null default '{}',
  specialties text[] not null default '{}',
  durability smallint check (durability between 0 and 100),
  offense smallint check (offense between 0 and 100),
  control_effect smallint check (control_effect between 0 and 100),
  difficulty smallint check (difficulty between 0 and 100),
  lore text,
  head_image_url text,
  portrait_image_url text,
  is_active boolean not null default true,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.heroes is 'Official hero catalog. id is the official hero_id.';
comment on column public.heroes.roles is 'One or two roles, primary role first.';
comment on column public.heroes.is_active is 'False when the official source no longer lists the hero.';

create index heroes_roles_idx on public.heroes using gin (roles);
create index heroes_lanes_idx on public.heroes using gin (lanes);
create trigger heroes_set_updated_at before update on public.heroes
  for each row execute function public.set_updated_at();

create table public.hero_skills (
  id integer generated always as identity primary key,
  hero_id smallint not null references public.heroes (id) on delete cascade,
  slot smallint not null check (slot >= 0),
  source_skill_id integer,
  name text not null,
  description text not null,
  cooldown text,
  cost text,
  tags text[] not null default '{}',
  icon_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hero_id, slot)
);

comment on column public.hero_skills.slot is '0 is the passive, then skills in display order.';
comment on column public.hero_skills.description is 'Plain text; markup from the source is stripped.';

create trigger hero_skills_set_updated_at before update on public.hero_skills
  for each row execute function public.set_updated_at();

create table public.hero_tags (
  hero_id smallint primary key references public.heroes (id) on delete cascade,
  damage_type public.damage_type not null,
  frontline smallint not null default 0 check (frontline between 0 and 3),
  hard_cc smallint not null default 0 check (hard_cc between 0 and 3),
  peel smallint not null default 0 check (peel between 0 and 3),
  aoe_damage smallint not null default 0 check (aoe_damage between 0 and 3),
  pickoff smallint not null default 0 check (pickoff between 0 and 3),
  push smallint not null default 0 check (push between 0 and 3),
  mobility smallint not null default 0 check (mobility between 0 and 3),
  sustain smallint not null default 0 check (sustain between 0 and 3),
  burst smallint not null default 0 check (burst between 0 and 3),
  scaling smallint not null default 0 check (scaling between 0 and 3),
  needs_review boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

comment on table public.hero_tags is
  'Hand-curated composition attributes. Source of truth: seed/hero-tags.json. Never written by the updater.';
comment on column public.hero_tags.scaling is 'Late-game scaling: 0 falls off, 3 hyper-carry.';
comment on column public.hero_tags.needs_review is 'True when the tags still need a human check.';

create trigger hero_tags_set_updated_at before update on public.hero_tags
  for each row execute function public.set_updated_at();

create table public.hero_relations (
  hero_id smallint not null references public.heroes (id) on delete cascade,
  relation public.hero_relation not null,
  target_hero_id smallint not null references public.heroes (id) on delete cascade,
  description text,
  primary key (hero_id, relation, target_hero_id),
  check (hero_id <> target_hero_id)
);

comment on table public.hero_relations is 'Official editorial relations from the hero detail page.';

create index hero_relations_target_idx on public.hero_relations (target_hero_id);

create table public.items (
  id integer primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  category public.item_category not null,
  tier smallint check (tier between 1 and 3),
  price integer check (price >= 0),
  attributes jsonb not null default '[]' check (jsonb_typeof(attributes) = 'array'),
  passives jsonb not null default '[]' check (jsonb_typeof(passives) = 'array'),
  builds_into integer[] not null default '{}',
  icon_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.items.attributes is 'Array of {"label": string, "value": string}.';
comment on column public.items.passives is 'Array of {"name": string, "description": string}.';
comment on column public.items.builds_into is 'Soft reference to items.id (no foreign key).';

create index items_category_idx on public.items (category);
create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();

create table public.emblems (
  id integer primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  attributes jsonb not null default '[]' check (jsonb_typeof(attributes) = 'array'),
  icon_url text,
  recommended_roles public.hero_role[] not null default '{}',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.emblems is 'Emblem sets.';
comment on column public.emblems.recommended_roles is 'Curated fallback when build data is missing.';

create trigger emblems_set_updated_at before update on public.emblems
  for each row execute function public.set_updated_at();

create table public.emblem_talents (
  id integer primary key,
  name text not null,
  tier smallint not null check (tier between 1 and 3),
  description text not null,
  icon_url text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.emblem_talents is
  'Talents are shared by every emblem set in the current game, so there is no foreign key to emblems.';

create index emblem_talents_tier_idx on public.emblem_talents (tier);
create trigger emblem_talents_set_updated_at before update on public.emblem_talents
  for each row execute function public.set_updated_at();

create table public.battle_spells (
  id integer primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null,
  short_description text,
  icon_url text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger battle_spells_set_updated_at before update on public.battle_spells
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------

create table public.data_update_logs (
  id bigint generated always as identity primary key,
  job text not null check (job in ('stats', 'catalog', 'retention', 'seed')),
  status public.update_status not null default 'running',
  triggered_by text not null check (triggered_by in ('schedule', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  requests_made integer not null default 0 check (requests_made >= 0),
  retries integer not null default 0 check (retries >= 0),
  rows_written integer not null default 0 check (rows_written >= 0),
  message text,
  details jsonb,
  workflow_run_url text
);

comment on table public.data_update_logs is 'One row per updater or seed run. Never store secrets in message or details.';

create index data_update_logs_job_started_idx on public.data_update_logs (job, started_at desc);

-- ---------------------------------------------------------------------------
-- Statistics
-- ---------------------------------------------------------------------------

create table public.stat_snapshots (
  id bigint generated always as identity primary key,
  rank_bracket public.rank_bracket not null,
  period_days smallint not null check (period_days in (1, 3, 7, 15, 30)),
  snapshot_date date not null,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  hero_count smallint not null check (hero_count >= 0),
  has_matchups boolean not null default false,
  is_published boolean not null default false,
  run_id bigint references public.data_update_logs (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (rank_bracket, period_days, snapshot_date)
);

comment on table public.stat_snapshots is
  'One row per rank bracket, period and date. Child rows are written first; is_published flips to true last.';

create index stat_snapshots_published_idx on public.stat_snapshots (rank_bracket, period_days, snapshot_date desc)
  where is_published;
create index stat_snapshots_run_idx on public.stat_snapshots (run_id);

create table public.hero_stats (
  snapshot_id bigint not null references public.stat_snapshots (id) on delete cascade,
  hero_id smallint not null references public.heroes (id) on delete cascade,
  win_rate real not null check (win_rate between 0 and 1),
  pick_rate real not null check (pick_rate between 0 and 1),
  ban_rate real not null check (ban_rate between 0 and 1),
  primary key (snapshot_id, hero_id)
);

comment on table public.hero_stats is 'Tier is not stored: the app computes it from src/config/tier-scoring.ts.';

create index hero_stats_hero_idx on public.hero_stats (hero_id);

create table public.hero_matchups (
  snapshot_id bigint not null references public.stat_snapshots (id) on delete cascade,
  hero_id smallint not null references public.heroes (id) on delete cascade,
  opponent_id smallint not null references public.heroes (id) on delete cascade,
  win_rate_delta real not null check (win_rate_delta between -1 and 1),
  sample_size integer check (sample_size >= 0),
  primary key (snapshot_id, hero_id, opponent_id),
  check (hero_id <> opponent_id)
);

comment on column public.hero_matchups.win_rate_delta is
  'Change in the hero''s win rate against this opponent. Positive means the hero is favored.';
comment on column public.hero_matchups.sample_size is 'The source does not provide match counts today.';

create index hero_matchups_hero_idx on public.hero_matchups (hero_id);
create index hero_matchups_opponent_idx on public.hero_matchups (opponent_id);

create table public.hero_synergies (
  snapshot_id bigint not null references public.stat_snapshots (id) on delete cascade,
  hero_id smallint not null references public.heroes (id) on delete cascade,
  teammate_id smallint not null references public.heroes (id) on delete cascade,
  win_rate_delta real not null check (win_rate_delta between -1 and 1),
  sample_size integer check (sample_size >= 0),
  primary key (snapshot_id, hero_id, teammate_id),
  check (hero_id <> teammate_id)
);

comment on column public.hero_synergies.win_rate_delta is
  'Change in the hero''s win rate when playing with this teammate.';

create index hero_synergies_hero_idx on public.hero_synergies (hero_id);
create index hero_synergies_teammate_idx on public.hero_synergies (teammate_id);

-- ---------------------------------------------------------------------------
-- Builds
-- ---------------------------------------------------------------------------

create table public.hero_recommended_builds (
  id bigint generated always as identity primary key,
  hero_id smallint not null references public.heroes (id) on delete cascade,
  lane public.hero_lane not null,
  rank_bracket public.rank_bracket not null,
  build_rank smallint not null check (build_rank >= 1),
  emblem_id integer references public.emblems (id) on delete set null,
  talent_t1_id integer references public.emblem_talents (id) on delete set null,
  talent_t2_id integer references public.emblem_talents (id) on delete set null,
  talent_t3_id integer references public.emblem_talents (id) on delete set null,
  battle_spell_id integer references public.battle_spells (id) on delete set null,
  pick_rate real check (pick_rate between 0 and 1),
  win_rate real check (win_rate between 0 and 1),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hero_id, lane, rank_bracket, build_rank)
);

comment on column public.hero_recommended_builds.build_rank is '1 is the most picked build.';

create index hero_recommended_builds_emblem_idx on public.hero_recommended_builds (emblem_id);
create index hero_recommended_builds_talent_t1_idx on public.hero_recommended_builds (talent_t1_id);
create index hero_recommended_builds_talent_t2_idx on public.hero_recommended_builds (talent_t2_id);
create index hero_recommended_builds_talent_t3_idx on public.hero_recommended_builds (talent_t3_id);
create index hero_recommended_builds_spell_idx on public.hero_recommended_builds (battle_spell_id);
create trigger hero_recommended_builds_set_updated_at before update on public.hero_recommended_builds
  for each row execute function public.set_updated_at();

create table public.hero_build_items (
  build_id bigint not null references public.hero_recommended_builds (id) on delete cascade,
  slot smallint not null check (slot between 1 and 6),
  item_id integer not null references public.items (id) on delete restrict,
  primary key (build_id, slot)
);

create index hero_build_items_item_idx on public.hero_build_items (item_id);

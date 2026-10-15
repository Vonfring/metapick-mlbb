import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaretLeftIcon, InfoIcon } from "@/components/icons";
import { PairingList, type PairingEntry } from "@/components/hero/pairing-list";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import { TierBadge } from "@/components/meta/tier-badge";
import { LevelSteps, Meter } from "@/components/stats/meter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_BRACKET,
  DEFAULT_PERIOD,
  MATCHUP_PERIOD,
} from "@/config/filters";
import {
  getHeroDetails,
  getHeroes,
  getPairsSnapshot,
  getRankedHeroes,
  type RankedHero,
  type SnapshotInfo,
} from "@/lib/data";
import { formatDate, formatPercent } from "@/lib/format";
import {
  bestTeammates,
  counteredBy,
  type Pairing,
  strongAgainst,
} from "@/lib/heroes/pairings";
import { displaySkills } from "@/lib/heroes/skills";
import { damageTypeLabels, RATING_FIELDS, TAG_FIELDS } from "@/lib/heroes/tags";
import type { HeroRelationKind } from "@/types/data";
import {
  bracketLabels,
  laneLabels,
  periodLabels,
  RANK_BRACKETS,
  roleLabels,
} from "@/types/domain";

export async function generateStaticParams() {
  const heroes = await getHeroes();
  // Cache Components needs at least one path. Before any hero data exists,
  // the placeholder prerenders as a not-found page.
  if (heroes.length === 0) return [{ slug: "no-heroes-yet" }];
  return heroes.map((hero) => ({ slug: hero.slug }));
}

/**
 * Looks the slug up in the cached roster, so an unknown URL never costs a
 * database query of its own.
 */
async function findHero(slug: string) {
  return (await getHeroes()).find((hero) => hero.slug === slug);
}

/** "Mythic, last 7 days" */
function describeSnapshot(snapshot: SnapshotInfo | null) {
  return snapshot
    ? `${bracketLabels[snapshot.rank_bracket]}, ${periodLabels[snapshot.period_days].toLowerCase()}`
    : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/heroes/[slug]">): Promise<Metadata> {
  const hero = await findHero((await params).slug);
  if (!hero) return { title: "Hero not found" };
  const roles = hero.roles.map((role) => roleLabels[role]).join(" and ");
  return {
    title: hero.name,
    description: `${hero.name} (${roles}) in Mobile Legends: win rate, tier, the heroes ${hero.name} beats and loses to, best teammates and skills.`,
    alternates: { canonical: `/heroes/${hero.slug}` },
  };
}

const relationTitles: Record<HeroRelationKind, string> = {
  best_teammate: "Works well with",
  strong_against: "Strong against",
  weak_against: "Weak against",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StatFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-xl leading-tight font-semibold tabular-nums sm:text-2xl">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/heroes"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <CaretLeftIcon className="size-4" aria-hidden />
      All heroes
    </Link>
  );
}

/** Shown while a hero page streams in, for example on the first visit to a new hero. */
function HeroPageSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading hero"
    >
      <BackLink />
      <div className="flex flex-col gap-5 sm:flex-row">
        <Skeleton className="size-28 rounded-sm" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

// The hero page reads its slug inside <Suspense>, so navigating to a hero
// shows the skeleton at once. Every hero known at build time is prerendered.
export default function HeroPage(props: PageProps<"/heroes/[slug]">) {
  return (
    <Suspense fallback={<HeroPageSkeleton />}>
      <HeroDetail params={props.params} />
    </Suspense>
  );
}

async function HeroDetail({
  params,
}: Pick<PageProps<"/heroes/[slug]">, "params">) {
  const { slug } = await params;
  // Inside <Suspense> the response has already started, so an unknown slug
  // gets the not-found page with a noindex tag rather than a 404 status.
  if (!(await findHero(slug))) notFound();
  const details = await getHeroDetails(slug);
  if (!details) notFound();
  const { hero, skills, relations, tags } = details;

  const [current, pairs, byRank] = await Promise.all([
    getRankedHeroes(DEFAULT_BRACKET, DEFAULT_PERIOD),
    getPairsSnapshot(DEFAULT_BRACKET, MATCHUP_PERIOD),
    Promise.all(
      RANK_BRACKETS.map((bracket) => getRankedHeroes(bracket, DEFAULT_PERIOD)),
    ),
  ]);
  const heroById = new Map(current.heroes.map((h) => [h.id, h]));
  const me = heroById.get(hero.id);
  const toEntries = (pairings: Pairing[]): PairingEntry[] =>
    pairings.flatMap(({ heroId, delta }) => {
      const other = heroById.get(heroId);
      return other ? [{ hero: other, delta }] : [];
    });
  const matchups = pairs?.matchups ?? [];
  const beats = toEntries(strongAgainst(hero.id, matchups));
  const losesTo = toEntries(counteredBy(hero.id, matchups));
  const teammates = toEntries(bestTeammates(hero.id, pairs?.synergies ?? []));
  const context = describeSnapshot(current.snapshot);
  const pairContext = describeSnapshot(pairs);

  const relationGroups = (Object.keys(relationTitles) as HeroRelationKind[])
    .map((kind) => {
      const rows = relations.filter((r) => r.relation === kind);
      const targets = rows
        .map((r) => heroById.get(r.target_hero_id))
        .filter((h): h is RankedHero => h !== undefined);
      return {
        kind,
        targets,
        description: rows.find((r) => r.description)?.description ?? null,
      };
    })
    .filter((group) => group.targets.length > 0);

  const ratings = RATING_FIELDS.flatMap(({ key, label }) => {
    const value = hero[key];
    return value === null ? [] : [{ label, value }];
  });

  return (
    <article className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <BackLink />

        <header className="flex items-start gap-4 sm:gap-5">
          <div className="w-20 shrink-0 sm:w-28">
            <HeroAvatar
              name={hero.name}
              src={hero.head_image_url}
              size="xl"
              fluid
              preload
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">
                {hero.name}
              </h1>
              <p className="text-muted-foreground">
                {hero.roles.map((role) => roleLabels[role]).join(" and ")}
                {hero.lanes.length > 0
                  ? `, ${hero.lanes.map((lane) => laneLabels[lane]).join(" or ")}`
                  : ""}
              </p>
            </div>
            {hero.specialties.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Specialties">
                {hero.specialties.map((specialty) => (
                  <li
                    key={specialty}
                    className="rounded-sm bg-muted px-2 py-0.5 text-xs font-medium"
                  >
                    {specialty}
                  </li>
                ))}
              </ul>
            ) : null}
            {hero.lore ? (
              <p className="max-w-[65ch] text-sm text-muted-foreground">
                {hero.lore}
              </p>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-x-3 gap-y-3 rounded-lg border bg-surface p-4 sm:flex sm:flex-wrap sm:gap-x-8 sm:px-5">
          {me?.tier ? (
            <TierBadge tier={me.tier} size="lg" />
          ) : (
            <span className="max-w-24 text-sm leading-tight text-muted-foreground">
              {(me?.winRate ?? null) === null
                ? "No stats yet"
                : "Rarely picked"}
            </span>
          )}
          <StatFigure label="Win rate" value={formatPercent(me?.winRate)} />
          <StatFigure
            label="Pick rate"
            value={formatPercent(me?.pickRate, 2)}
          />
          <StatFigure label="Ban rate" value={formatPercent(me?.banRate)} />
          {context ? (
            <p className="col-span-full text-sm text-muted-foreground sm:ml-auto">
              {context}
              {current.snapshot
                ? `, updated ${formatDate(current.snapshot.fetched_at)}`
                : ""}
            </p>
          ) : null}
        </div>
      </div>

      <Section
        title="Matchups"
        description={`How ${hero.name}'s win rate changes against each hero, in percentage points${pairContext ? ` (${pairContext})` : ""}. The official data lists each hero's five best and five worst matchups.`}
      >
        <div className="relative grid overflow-hidden rounded-lg border md:grid-cols-2">
          <div className="flex flex-col gap-2 bg-ally-soft/50 p-4">
            <h3 className="text-sm font-semibold text-ally-text">
              Strong against
            </h3>
            <PairingList
              entries={beats}
              empty="No favorable matchups in the data."
            />
          </div>
          <div className="flex flex-col gap-2 border-t bg-enemy-soft/50 p-4 md:border-t-0 md:border-l">
            <h3 className="text-sm font-semibold text-enemy-text">
              Countered by
            </h3>
            <PairingList
              entries={losesTo}
              empty="No unfavorable matchups in the data."
            />
          </div>
        </div>
      </Section>

      <Section
        title="Best teammates"
        description={`Heroes that raise ${hero.name}'s win rate most when on the same team${pairContext ? ` (${pairContext})` : ""}.`}
      >
        <div className="rounded-lg border bg-surface p-3">
          <PairingList
            entries={teammates}
            empty="No teammate data for this hero yet."
          />
        </div>
      </Section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <Section title="Skills">
            <ol className="flex flex-col divide-y rounded-lg border bg-surface">
              {displaySkills(skills).map((skill) => (
                <li
                  key={`${skill.slot}-${skill.name}`}
                  className="flex flex-col gap-1.5 px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-semibold">{skill.name}</h3>
                    {skill.slot === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Passive
                      </span>
                    ) : null}
                    {skill.cooldown ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Cooldown {skill.cooldown}s
                      </span>
                    ) : null}
                    {skill.cost ? (
                      <span className="text-xs text-muted-foreground">
                        {skill.cost}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {skill.description}
                  </p>
                  {skill.tags.length > 0 ? (
                    <ul
                      className="flex flex-wrap gap-1"
                      aria-label="Skill effects"
                    >
                      {skill.tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-sm bg-muted px-1.5 py-0.5 text-xs"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </Section>

          {relationGroups.length > 0 ? (
            <Section
              title="Official notes"
              description="What the official hero guide says about pairings."
            >
              <div className="flex flex-col gap-4">
                {relationGroups.map((group) => (
                  <div
                    key={group.kind}
                    className="flex flex-col gap-2 rounded-lg border bg-surface p-4"
                  >
                    <h3 className="text-sm font-semibold">
                      {relationTitles[group.kind]}
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {group.targets.map((target) => (
                        <li key={target.id}>
                          <Link
                            href={`/heroes/${target.slug}`}
                            className="flex items-center gap-2 rounded-md border bg-background py-1 pr-2.5 pl-1 text-sm hover:border-foreground/40"
                          >
                            <HeroAvatar
                              name={target.name}
                              src={target.head_image_url}
                              size="xs"
                              decorative
                            />
                            {target.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {group.description ? (
                      <p className="text-sm text-muted-foreground">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-10">
          <Section
            title="By rank"
            description={`${periodLabels[DEFAULT_PERIOD]}.`}
          >
            <div className="overflow-hidden rounded-lg border bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Rank
                    </th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">
                      Tier
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-right font-medium"
                    >
                      Win
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Ban
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byRank.map((rank, index) => {
                    const row = rank.heroes.find((h) => h.id === hero.id);
                    const bracket = RANK_BRACKETS[index]!;
                    return (
                      <tr
                        key={bracket}
                        className={
                          bracket === DEFAULT_BRACKET
                            ? "bg-ally-soft/40"
                            : undefined
                        }
                      >
                        <th
                          scope="row"
                          className="px-3 py-2 text-left font-medium"
                        >
                          {bracketLabels[bracket]}
                        </th>
                        <td className="px-2 py-2">
                          {row?.tier ? (
                            <TierBadge tier={row.tier} size="sm" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatPercent(row?.winRate)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatPercent(row?.banRate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {ratings.length > 0 ? (
            <Section
              title="Hero ratings"
              description="Official ratings from 0 to 100."
            >
              <div className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
                {ratings.map((rating) => (
                  <Meter
                    key={rating.label}
                    label={rating.label}
                    value={rating.value}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {tags ? (
            <Section
              title="Team role"
              description="Curated by hand for team composition and draft suggestions, from 0 to 3."
            >
              <div className="flex flex-col gap-2.5 rounded-lg border bg-surface p-4">
                <p className="text-sm font-medium">
                  {damageTypeLabels[tags.damage_type]}
                </p>
                {TAG_FIELDS.map(({ key, label }) => (
                  <LevelSteps key={key} label={label} level={tags[key]} />
                ))}
                {tags.needs_review ? (
                  <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
                    <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                    These values still need a check against recent games.
                  </p>
                ) : null}
              </div>
            </Section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

"use client";

import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import {
  SHARED_EMBLEM_SLUG,
  setForRole,
  type TalentView,
  talentTierLabels,
} from "@/lib/catalog/emblems";
import { oneOf, useUrlParams } from "@/lib/use-url-params";
import { cn } from "@/lib/utils";
import type { EmblemRow } from "@/types/data";
import { HERO_ROLES, type HeroRole, roleLabels } from "@/types/domain";

export type EmblemSetView = Pick<
  EmblemRow,
  "id" | "slug" | "name" | "attributes" | "recommended_roles"
>;

function SetCard({
  set,
  recommended,
}: {
  set: EmblemSetView;
  recommended: boolean;
}) {
  const roles = set.recommended_roles
    .map((role) => roleLabels[role])
    .join(" and ");
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-surface p-4",
        recommended && "border-ally bg-ally-soft/40",
      )}
    >
      <header className="flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">{set.name}</h3>
          {recommended ? (
            <span className="rounded-sm bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Recommended
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {set.slug === SHARED_EMBLEM_SLUG
            ? "No role of its own. Every set can take its talents."
            : roles
              ? `Made for ${roles} heroes`
              : "No role listed"}
        </p>
      </header>
      <ul className="flex flex-col gap-0.5 text-sm" aria-label="Stats">
        {set.attributes.map((attribute) => (
          <li key={attribute.label}>
            <span className="font-medium tabular-nums">{attribute.value}</span>{" "}
            {attribute.label}
          </li>
        ))}
      </ul>
    </article>
  );
}

function TalentEntry({ talent }: { talent: TalentView }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h4 className="font-semibold">{talent.name}</h4>
        <span className="text-xs text-muted-foreground">
          {talent.setName ? `${talent.setName} set` : "Any set"}
        </span>
      </div>
      {talent.summary ? (
        <p className="text-sm font-medium">{talent.summary}</p>
      ) : null}
      <p className="text-sm whitespace-pre-line text-muted-foreground">
        {talent.text}
      </p>
      {talent.cooldown ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          Cooldown {talent.cooldown}s
        </p>
      ) : null}
    </li>
  );
}

/** Emblem sets and talents, narrowed to one role's set when a role is picked. */
export function EmblemExplorer({
  sets,
  talents,
}: {
  sets: EmblemSetView[];
  talents: TalentView[];
}) {
  const [params, setParams] = useUrlParams();
  const role = oneOf<HeroRole>(params.get("role"), HERO_ROLES);
  const recommended = role === "all" ? undefined : setForRole(sets, role);

  // A picked role shows its set first, then the shared set.
  const shownSets =
    role === "all"
      ? sets
      : sets
          .filter(
            (set) =>
              set.id === recommended?.id || set.slug === SHARED_EMBLEM_SLUG,
          )
          .sort(
            (a, b) =>
              Number(b.id === recommended?.id) -
              Number(a.id === recommended?.id),
          );
  // A set's own talents come before the shared ones.
  const shownTalents =
    role === "all"
      ? talents
      : talents
          .filter(
            (talent) =>
              talent.setId === null || talent.setId === recommended?.id,
          )
          .sort((a, b) => Number(a.setId === null) - Number(b.setId === null));
  const tiers = [...new Set(talents.map((talent) => talent.tier))].sort(
    (a, b) => a - b,
  );

  const options: ChipOption<HeroRole | "all">[] = [
    { value: "all", label: "All roles" },
    ...HERO_ROLES.map((r) => ({ value: r, label: roleLabels[r] })),
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <ChipGroup
          label="Role"
          options={options}
          value={role}
          onChange={(value) =>
            setParams({ role: value === "all" ? null : value })
          }
        />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {role === "all"
            ? "Pick a role to see the set made for it and the talents that set can take."
            : recommended
              ? `The ${recommended.name} set is made for ${roleLabels[role]} heroes. A loadout takes one talent per tier, from the ${recommended.name} set or from the talents every set can take.`
              : `No set lists the ${roleLabels[role]} role. The shared talents are below.`}
        </p>
      </div>

      <section aria-labelledby="emblem-sets" className="flex flex-col gap-3">
        <h2 id="emblem-sets" className="font-display text-lg font-semibold">
          Sets
        </h2>
        <ul className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shownSets.map((set) => (
            <li key={set.id}>
              <SetCard set={set} recommended={set.id === recommended?.id} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="emblem-talents" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="emblem-talents"
            className="font-display text-lg font-semibold"
          >
            Talents
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick one talent for each tier.
          </p>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {tiers.map((tier) => {
            const inTier = shownTalents.filter(
              (talent) => talent.tier === tier,
            );
            return (
              <div key={tier} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  {talentTierLabels[tier] ?? `Tier ${tier}`}
                  <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                    {inTier.length}
                  </span>
                </h3>
                <ul className="flex flex-col divide-y rounded-lg border bg-surface">
                  {inTier.map((talent) => (
                    <TalentEntry key={talent.id} talent={talent} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

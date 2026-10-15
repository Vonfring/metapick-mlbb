import type { Metadata } from "next";
import {
  EmblemExplorer,
  type EmblemSetView,
} from "@/components/emblems/emblem-explorer";
import { HexagonIcon } from "@/components/icons";
import { EmptyState } from "@/components/meta/empty-state";
import { PageHeader } from "@/components/meta/page-header";
import { toTalentViews } from "@/lib/catalog/emblems";
import { splitCooldown } from "@/lib/catalog/text";
import { getEmblemCatalog, getSpells } from "@/lib/data";

export const metadata: Metadata = {
  title: "Emblems",
  description:
    "Mobile Legends emblem sets and talents, the set each role runs, and every battle spell.",
};

export default async function EmblemsPage() {
  const [{ emblems, talents }, spells] = await Promise.all([
    getEmblemCatalog(),
    getSpells(),
  ]);
  const sets: EmblemSetView[] = emblems.map(
    ({ id, slug, name, attributes, recommended_roles }) => ({
      id,
      slug,
      name,
      attributes,
      recommended_roles,
    }),
  );

  return (
    <>
      <PageHeader
        title="Emblems"
        description="Each emblem set gives fixed stats and a choice of talents. Pick your role to see the set made for it."
      />

      {sets.length > 0 ? (
        <EmblemExplorer sets={sets} talents={toTalentViews(emblems, talents)} />
      ) : (
        <EmptyState
          icon={HexagonIcon}
          title="No emblem data yet"
          description="Emblem sets and talents appear here after the next catalog update."
        />
      )}

      {spells.length > 0 ? (
        <section
          aria-labelledby="battle-spells"
          className="mt-10 flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="battle-spells"
              className="font-display text-lg font-semibold"
            >
              Battle spells
            </h2>
            <p className="text-sm text-muted-foreground">
              Every hero takes one spell into the match.
            </p>
          </div>
          <ul className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {spells.map((spell) => {
              const { text, cooldown } = splitCooldown(spell.description);
              return (
                <li
                  key={spell.id}
                  className="flex flex-col gap-1 rounded-lg border bg-surface p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">{spell.name}</h3>
                    {cooldown ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Cooldown {cooldown}s
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {text}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}

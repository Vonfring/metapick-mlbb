import Link from "next/link";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import { RateDelta } from "@/components/meta/rate-delta";
import type { HeroRow } from "@/types/data";

export type PairingEntry = {
  hero: Pick<HeroRow, "slug" | "name" | "head_image_url">;
  delta: number;
};

/** Heroes with the change in win rate each one brings. */
export function PairingList({
  entries,
  empty,
}: {
  entries: PairingEntry[];
  empty: string;
}) {
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {entries.map(({ hero, delta }) => (
        <li key={hero.slug}>
          <Link
            href={`/heroes/${hero.slug}`}
            className="flex items-center gap-3 rounded-md px-1.5 py-1 hover:bg-surface/80"
          >
            <HeroAvatar
              name={hero.name}
              src={hero.head_image_url}
              size="sm"
              decorative
            />
            <span className="flex-1 truncate font-medium">{hero.name}</span>
            <RateDelta delta={delta} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

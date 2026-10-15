"use client";

import { useId, useState } from "react";
import { MagnifyingGlassIcon } from "@/components/icons";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import { Input } from "@/components/ui/input";
import type { HeroSummary } from "@/lib/data";
import { searchKey } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Search-first hero picker: type a few letters, or tap a portrait. Heroes
 * show in the given order (most picked first) so likely picks need no
 * typing. Enter picks the first match.
 */
export function HeroPicker({
  heroes,
  taken,
  onPick,
  placeholder,
  caption,
  actionLabel,
  blocked,
  inputRef,
  className,
}: {
  heroes: readonly HeroSummary[];
  /** Heroes already used; shown dimmed and cannot be picked again. */
  taken: ReadonlySet<number>;
  onPick: (hero: HeroSummary) => void;
  placeholder: string;
  /** What the order means, shown while the search is empty. */
  caption: string;
  /** Accessible name of each portrait button, e.g. "Add Fanny to the enemy team". */
  actionLabel: (name: string) => string;
  /** Why nothing can be picked right now (a full team), or null. */
  blocked?: string | null;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const statusId = useId();
  const key = searchKey(query);
  const shown = key
    ? heroes.filter((h) => searchKey(h.name).includes(key))
    : heroes;

  const pick = (hero: HeroSummary) => {
    onPick(hero);
    setQuery("");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <div className="relative">
        <MagnifyingGlassIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={inputId}
          type="search"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={placeholder}
          value={query}
          aria-describedby={statusId}
          disabled={Boolean(blocked)}
          className="h-11 pl-9"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !key || blocked) return;
            const first = shown.find((h) => !taken.has(h.id));
            if (first) {
              e.preventDefault();
              pick(first);
            }
          }}
        />
      </div>
      <p
        id={statusId}
        className={cn(
          "text-xs",
          blocked ? "text-enemy-text" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {blocked ??
          (key
            ? `${shown.length} ${shown.length === 1 ? "match" : "matches"}`
            : caption)}
      </p>
      {blocked ? null : shown.length > 0 ? (
        <ul className="grid max-h-72 grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1 overflow-y-auto overscroll-contain rounded-lg border bg-surface p-1.5">
          {shown.map((hero) => {
            const isTaken = taken.has(hero.id);
            return (
              <li key={hero.id}>
                <button
                  type="button"
                  disabled={isTaken}
                  aria-label={
                    isTaken
                      ? `${hero.name}, already picked`
                      : actionLabel(hero.name)
                  }
                  onClick={() => pick(hero)}
                  className="flex w-full flex-col items-center gap-1 rounded-md p-1 text-center transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <HeroAvatar
                    name={hero.name}
                    src={hero.head_image_url}
                    size="sm"
                    decorative
                  />
                  <span className="w-full truncate text-xs">{hero.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          No hero matches “{query}”.
        </p>
      )}
    </div>
  );
}

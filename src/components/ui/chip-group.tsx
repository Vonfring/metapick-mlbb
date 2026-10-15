"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

/**
 * A single-choice row of chips (Radix toggle group: arrow keys move between
 * chips). Scrolls sideways on narrow screens instead of wrapping.
 */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      className={cn(
        "-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-surface px-3 text-sm font-medium text-muted-foreground",
            "transition-colors hover:bg-surface-2 hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background",
          )}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className="text-xs tabular-nums opacity-70">
              {option.count}
            </span>
          ) : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

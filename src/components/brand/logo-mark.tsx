import { cn } from "@/lib/utils";

/** The two halves on a 24 × 24 grid, shared with the Open Graph images. */
export const LOGO_PATHS = {
  enemy: "M4.5 2H22v17.5z",
  ally: "M2 4.5 19.5 22H2z",
} as const;

/**
 * Two triangles split by a diagonal gap: the blue side (bottom left) and the
 * red side (top right) of the map, with the river between them.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      <path d={LOGO_PATHS.enemy} fill="var(--color-enemy)" />
      <path d={LOGO_PATHS.ally} fill="var(--color-ally)" />
    </svg>
  );
}

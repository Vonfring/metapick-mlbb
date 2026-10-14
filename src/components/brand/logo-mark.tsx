import { cn } from "@/lib/utils";

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
      <path d="M4.5 2H22v17.5z" fill="var(--color-enemy)" />
      <path d="M2 4.5 19.5 22H2z" fill="var(--color-ally)" />
    </svg>
  );
}

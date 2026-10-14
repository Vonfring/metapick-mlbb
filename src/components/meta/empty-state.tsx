import type * as React from "react";
import type { IconComponent } from "@/components/icons";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: IconComponent;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-dashed bg-surface/60 px-5 py-8 sm:px-8",
        className,
      )}
    >
      {Icon ? (
        <Icon className="size-8 text-muted-foreground" aria-hidden />
      ) : null}
      <div className="flex max-w-[60ch] flex-col gap-1">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

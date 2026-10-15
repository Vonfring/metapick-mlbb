import type * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border bg-surface px-3 text-base text-foreground sm:text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&::-webkit-search-cancel-button]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

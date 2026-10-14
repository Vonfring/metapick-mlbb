import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} home`}
      className={cn("inline-flex items-center gap-2 rounded-sm", className)}
    >
      <LogoMark className="size-6" />
      <span className="font-display text-[1.375rem] leading-none font-bold tracking-tight">
        {siteConfig.wordmark}
      </span>
      <span className="rounded-[5px] border px-1.5 py-[3px] text-[0.625rem] leading-none font-bold text-muted-foreground">
        {siteConfig.label}
      </span>
    </Link>
  );
}

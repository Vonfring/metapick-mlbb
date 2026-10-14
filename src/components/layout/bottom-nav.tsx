"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  allNavItems,
  isActivePath,
  mobilePrimaryHrefs,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { MoreDrawer } from "./more-drawer";

const primaryItems = mobilePrimaryHrefs.map((href) =>
  allNavItems.find((item) => item.href === href)!,
);

/** Fixed bottom bar for phones and tablets. */
export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const moreActive =
    !primaryItems.some((item) => isActivePath(pathname, item.href)) &&
    allNavItems.some((item) => isActivePath(pathname, item.href));

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-surface/85",
        className,
      )}
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {primaryItems.map(({ href, label, shortLabel, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                  active ? "text-ally-text" : "text-muted-foreground",
                )}
              >
                <Icon
                  className="size-6"
                  weight={active ? "fill" : "regular"}
                  aria-hidden
                />
                {shortLabel ?? label}
              </Link>
            </li>
          );
        })}
        <li>
          <MoreDrawer active={moreActive} />
        </li>
      </ul>
    </nav>
  );
}

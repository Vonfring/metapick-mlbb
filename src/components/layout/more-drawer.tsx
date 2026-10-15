"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DotsThreeOutlineIcon, InfoIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  isActivePath,
  mobilePrimaryHrefs,
  navGroups,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

const primary = new Set<string>(mobilePrimaryHrefs);

export function MoreDrawer({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
          active ? "text-ally-text" : "text-muted-foreground",
        )}
      >
        <DotsThreeOutlineIcon
          className="size-6"
          weight={active ? "fill" : "regular"}
          aria-hidden
        />
        More
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>More</DrawerTitle>
          <DrawerDescription>
            Every page, plus theme settings.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-2">
          {navGroups.map((group) => {
            const items = group.items.filter((item) => !primary.has(item.href));
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="pb-1 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                {items.map(({ href, label, description, icon: Icon }) => {
                  const current = isActivePath(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5",
                        current ? "bg-ally-soft" : "hover:bg-surface-2",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-5 shrink-0",
                          current ? "text-ally-text" : "text-muted-foreground",
                        )}
                        weight={current ? "fill" : "regular"}
                        aria-hidden
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
          <Link
            href="/about"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface-2"
          >
            <InfoIcon
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="text-sm font-medium">About the data</span>
          </Link>
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground">Theme</p>
            <ThemeToggle />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

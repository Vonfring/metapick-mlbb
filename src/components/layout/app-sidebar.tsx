import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

export function AppSidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "sticky top-0 h-dvh flex-col gap-8 overflow-y-auto border-r bg-surface px-4 py-6",
        className,
      )}
    >
      <Wordmark className="px-2" />
      <SidebarNav />
      <div className="mt-auto flex flex-col gap-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">Theme</p>
        <ThemeToggle />
      </div>
    </aside>
  );
}

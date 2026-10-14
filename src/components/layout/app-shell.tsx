import type * as React from "react";
import { AppSidebar } from "./app-sidebar";
import { BottomNav } from "./bottom-nav";
import { SiteFooter } from "./site-footer";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <AppSidebar className="hidden lg:flex" />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <TopBar className="lg:hidden" />
        <main
          id="main"
          className="flex-1 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-10"
        >
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
        <SiteFooter />
      </div>
      <BottomNav className="lg:hidden" />
    </div>
  );
}

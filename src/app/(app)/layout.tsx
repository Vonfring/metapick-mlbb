import type * as React from "react";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Every page of the app shares the sidebar, the mobile bars and the footer.
 * The welcome page sits outside this group with its own header and footer.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

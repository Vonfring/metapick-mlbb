import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

// Unknown URLs and notFound() in any page land here, outside the (app)
// layout, so the page brings its own shell.
export default function NotFound() {
  return (
    <AppShell>
      <NotFoundMessage />
    </AppShell>
  );
}

function NotFoundMessage() {
  return (
    <div className="flex max-w-[60ch] flex-col items-start gap-4 py-10">
      <p className="font-display text-sm font-semibold text-enemy-text">404</p>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">
        This page does not exist
      </h1>
      <p className="text-muted-foreground">
        The link may be old, or the hero name may be spelled differently.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/heroes">Browse heroes</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Open the app</Link>
        </Button>
      </div>
    </div>
  );
}

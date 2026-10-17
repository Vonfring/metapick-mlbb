"use client";

import Link from "next/link";
import { useEffect } from "react";
import { WarningIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex max-w-[60ch] flex-col items-start gap-4 py-10">
      <WarningIcon className="size-8 text-enemy-text" aria-hidden />
      <h1 className="font-display text-2xl font-bold">
        This page failed to load
      </h1>
      <p className="text-muted-foreground">
        Try again. If it keeps failing, the data service may be down for a
        moment.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}

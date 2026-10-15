import Link from "next/link";
import { PageHeader } from "@/components/meta/page-header";
import { EmptyState } from "@/components/meta/empty-state";
import type { IconComponent } from "@/components/icons";

/** Temporary page body for routes whose feature lands in a later phase. */
export function PlannedPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: IconComponent;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title="Not built yet"
        description="This page is part of an upcoming update. Hero data is imported first, then the tools that use it."
        action={
          <Link
            href="/about"
            className="text-sm font-medium text-ally-text hover:underline"
          >
            About the data
          </Link>
        }
      />
    </>
  );
}

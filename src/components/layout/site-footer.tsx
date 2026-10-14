import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t px-4 pt-6 pb-28 text-xs text-muted-foreground sm:px-6 lg:px-10 lg:pb-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-[65ch] flex-col gap-1">
          <p className="font-medium text-foreground">{siteConfig.disclaimer}</p>
          <p>{siteConfig.attribution}</p>
        </div>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/about" className="hover:text-foreground">
            About the data
          </Link>
        </nav>
      </div>
    </footer>
  );
}

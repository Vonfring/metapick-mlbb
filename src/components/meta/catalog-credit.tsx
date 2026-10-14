import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Attribution for the Liquipedia catalog (CC BY-SA 3.0). */
export function CatalogCredit({ className }: { className?: string }) {
  const { subject, source, license } = siteConfig.catalogCredit;
  const link = "underline underline-offset-2 hover:text-foreground";
  return (
    <p className={cn(className)}>
      {subject} from{" "}
      <a href={source.href} className={link} rel="noopener">
        {source.label}
      </a>{" "}
      contributors, licensed{" "}
      <a href={license.href} className={link} rel="noopener license">
        {license.label}
      </a>
      .
    </p>
  );
}

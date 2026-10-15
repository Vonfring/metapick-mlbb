import type { Metadata } from "next";
import { ItemBrowser } from "@/components/items/item-browser";
import { EmptyState } from "@/components/meta/empty-state";
import { PageHeader } from "@/components/meta/page-header";
import { SwordIcon } from "@/components/icons";
import { toItemViews } from "@/lib/catalog/items";
import { getItems } from "@/lib/data";

export const metadata: Metadata = {
  alternates: { canonical: "/items" },
  title: "Items",
  description:
    "Every Mobile Legends item by shop category, with stats, passives, price and build path.",
};

export default async function ItemsPage() {
  const items = toItemViews(await getItems());

  return (
    <>
      <PageHeader
        title="Items"
        description="Every item in the shop by category. Search for a name, a stat such as Crit Chance, or a word from a passive."
      />
      {items.length > 0 ? (
        <ItemBrowser items={items} />
      ) : (
        <EmptyState
          icon={SwordIcon}
          title="No items yet"
          description="Item data appears here after the next catalog update."
        />
      )}
    </>
  );
}

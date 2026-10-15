import { compareNames, searchKey } from "@/lib/format";
import type { ItemRow, LabeledValue, NamedText } from "@/types/data";
import type { ItemCategory } from "@/types/domain";

export const itemTierLabels: Record<number, string> = {
  1: "Basic",
  2: "Intermediate",
  3: "Final",
};

/** What the item browser needs per item, with the build path resolved to names. */
export type ItemView = {
  id: number;
  slug: string;
  name: string;
  category: ItemCategory;
  other_categories: ItemCategory[];
  tier: number | null;
  price: number | null;
  attributes: LabeledValue[];
  passives: NamedText[];
  /** Items this one is crafted from. */
  builtFrom: string[];
  /** Items that use this one in their recipe. */
  buildsInto: string[];
  /** Name, stats and passives, prepared for searchKey matching. */
  searchText: string;
};

/** Final items first, then by price (higher first) and name. Items without a tier go last. */
export function compareItems(
  a: Pick<ItemRow, "tier" | "price" | "name">,
  b: Pick<ItemRow, "tier" | "price" | "name">,
) {
  return (
    (b.tier ?? 0) - (a.tier ?? 0) ||
    (b.price ?? 0) - (a.price ?? 0) ||
    compareNames(a.name, b.name)
  );
}

export function toItemViews(items: ItemRow[]): ItemView[] {
  const names = new Map(items.map((item) => [item.id, item.name]));
  const builtFrom = new Map<number, string[]>();
  for (const item of items) {
    for (const parent of item.builds_into) {
      builtFrom.set(parent, [...(builtFrom.get(parent) ?? []), item.name]);
    }
  }
  return [...items].sort(compareItems).map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    category: item.category,
    other_categories: item.other_categories,
    tier: item.tier,
    price: item.price,
    attributes: item.attributes,
    passives: item.passives,
    builtFrom: (builtFrom.get(item.id) ?? []).sort(compareNames),
    buildsInto: item.builds_into
      .map((id) => names.get(id))
      .filter((name): name is string => name !== undefined)
      .sort(compareNames),
    searchText: searchKey(
      [
        item.name,
        ...item.attributes.map((a) => a.label),
        ...item.passives.flatMap((p) => [p.name, p.description]),
      ].join(" "),
    ),
  }));
}

export function inCategory(
  item: Pick<ItemView, "category" | "other_categories">,
  category: ItemCategory,
) {
  return item.category === category || item.other_categories.includes(category);
}

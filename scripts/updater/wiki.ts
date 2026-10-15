import {
  fetchCategoryMembers,
  fetchWikitext,
  type LiquipediaClient,
} from "../source/liquipedia";
import {
  EMBLEM_PORTAL,
  NAVBOXES,
  type RawCatalog,
} from "../source/transform/liquipedia";

/**
 * Downloads every page the catalog parser needs: two category lists, then
 * the pages 50 at a time (about 5 requests). Emblem sets and talents have
 * no pages of their own; they all come from the emblem portal.
 */
export async function downloadCatalog(
  client: LiquipediaClient,
): Promise<RawCatalog> {
  const fetchedAt = new Date().toISOString();
  const items = await fetchCategoryMembers(client, "Category:Items");
  const spells = await fetchCategoryMembers(client, "Category:Battle spells");
  const pages = await fetchWikitext(client, [
    ...new Set([EMBLEM_PORTAL, ...NAVBOXES, ...items, ...spells]),
  ]);
  return {
    fetched_at: fetchedAt,
    members: { items, spells },
    pages: Object.fromEntries(pages),
  };
}

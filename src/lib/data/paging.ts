export type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Reads every row of an ordered PostgREST query, page by page. PostgREST
 * caps each response at the project's "Max rows" setting (1000 by default,
 * and it can be lower), so only an empty page means the end.
 */
export async function selectAll<T>(
  what: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + pageSize - 1);
    if (error)
      throw new Error(`Supabase query failed (${what}): ${error.message}`);
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}

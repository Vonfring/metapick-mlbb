import { z } from "zod";
import type { SourceClient, SourceEnvelope } from "./client";
import { buildQuery, type SourceQuery } from "./query";

const pageSchema = z.looseObject({
  records: z.array(z.looseObject({ data: z.unknown() })),
  total: z.number().optional(),
});

/** The `data` object of every record in a source response, plus the reported total. */
export function extractRecords(envelope: SourceEnvelope): {
  records: unknown[];
  total: number | null;
} {
  const parsed = pageSchema.safeParse(envelope.data);
  if (!parsed.success) {
    const keys =
      envelope.data && typeof envelope.data === "object"
        ? Object.keys(envelope.data).join(", ")
        : typeof envelope.data;
    throw new Error(
      `Unexpected response shape: expected data.records[], got ${keys}`,
    );
  }
  return {
    records: parsed.data.records.map((r) => r.data),
    total: parsed.data.total ?? null,
  };
}

const PAGE_SIZE = 200;
const MAX_PAGES = 10;

/** Every record of a source, following pages until the reported total. */
export async function fetchAllRecords(
  client: SourceClient,
  baseUrl: string,
  sourceId: number,
  options: Omit<SourceQuery, "pageSize" | "pageIndex"> = {},
  pageSize = PAGE_SIZE,
): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { records, total } = extractRecords(
      await client.query(
        baseUrl,
        sourceId,
        buildQuery(pageSize, page, options),
      ),
    );
    all.push(...records);
    if (records.length < pageSize || (total !== null && all.length >= total))
      break;
  }
  return all;
}

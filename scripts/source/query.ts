export type SourceFilter = { field: string; operator: string; value: unknown };
export type SourceSort = {
  data: { field: string; order: "asc" | "desc" };
  type: "sequence";
};

export type SourceQuery = {
  pageSize: number;
  pageIndex: number;
  filters?: SourceFilter[];
  sorts?: SourceSort[];
  fields?: string[];
  object?: number[];
  type?: string;
};

export const eq = (field: string, value: unknown): SourceFilter => ({
  field,
  operator: "eq",
  value,
});

export const hasAnyOf = (field: string, values: unknown[]): SourceFilter => ({
  field,
  operator: "hasAnyOf",
  value: values,
});

export const sortBy = (
  field: string,
  order: "asc" | "desc" = "desc",
): SourceSort => ({
  data: { field, order },
  type: "sequence",
});

export function buildQuery(
  pageSize: number,
  pageIndex: number,
  options: Omit<SourceQuery, "pageSize" | "pageIndex"> = {},
): SourceQuery {
  const query: SourceQuery = { pageSize, pageIndex };
  if (options.filters) query.filters = options.filters;
  if (options.sorts) query.sorts = options.sorts;
  if (options.fields) query.fields = options.fields;
  if (options.object) query.object = options.object;
  if (options.type) query.type = options.type;
  return query;
}

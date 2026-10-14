/** Minimal, safe SQL literal rendering for generated seed files. */

export type SqlValue = string | number | boolean | null | undefined | SqlRaw;

export class SqlRaw {
  constructor(readonly sql: string) {}
}

/** Insert pre-rendered SQL as-is. Only for values built by this module. */
export const raw = (sql: string) => new SqlRaw(sql);

export function quote(text: string): string {
  if (text.includes("\u0000")) throw new Error("NUL bytes cannot be stored in Postgres text");
  return `'${text.replace(/'/g, "''")}'`;
}

export function literal(value: SqlValue): string {
  if (value instanceof SqlRaw) return value.sql;
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Cannot render non-finite number ${value}`);
    return String(value);
  }
  return quote(value);
}

/** `array['a','b']::public.hero_role[]`, or an empty array literal of that type. */
export function textArray(values: readonly string[], type = "text"): SqlRaw {
  if (values.length === 0) return raw(`'{}'::${type}[]`);
  return raw(`array[${values.map(quote).join(", ")}]::${type}[]`);
}

export function intArray(values: readonly number[]): SqlRaw {
  if (values.length === 0) return raw("'{}'::integer[]");
  return raw(`array[${values.map((v) => literal(Math.trunc(v))).join(", ")}]::integer[]`);
}

export function jsonb(value: unknown): SqlRaw {
  return raw(`${quote(JSON.stringify(value))}::jsonb`);
}

export function tuple(values: SqlValue[]): string {
  return `(${values.map(literal).join(", ")})`;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * `insert into table (cols) values ... on conflict ...` split into chunks so
 * no single statement gets huge.
 */
export function insertRows(
  table: string,
  columns: readonly string[],
  rows: SqlValue[][],
  onConflict: string,
  chunkSize = 300,
): string {
  if (rows.length === 0) return `-- ${table}: no rows\n`;
  return chunk(rows, chunkSize)
    .map(
      (part) =>
        `insert into ${table} (${columns.join(", ")}) values\n  ${part.map(tuple).join(",\n  ")}\n${onConflict};\n`,
    )
    .join("\n");
}

/** `set a = excluded.a, b = excluded.b` for an upsert. */
export function updateExcluded(columns: readonly string[]): string {
  return `set ${columns.map((c) => `${c} = excluded.${c}`).join(", ")}`;
}

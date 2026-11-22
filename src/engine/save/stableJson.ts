export type JsonRecord = Record<string, unknown>;

export function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trie récursivement les clés pour produire des diffs lisibles. */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isPlainObject(value)) return value;
  const entries = Object.keys(value)
    .sort()
    .map((key) => [key, sortValue(value[key])] as const);
  return Object.fromEntries(entries);
}

export function stableStringify(value: unknown, indent: number): string {
  return JSON.stringify(sortValue(value), null, indent);
}

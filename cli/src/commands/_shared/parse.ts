/** Split a comma-separated string, trim, drop empties. Returns `[]` for empty input. */
export function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Same as `parseCsv` but returns `undefined` instead of `[]` for empty input. */
export function parseCsvOptional(value: string | undefined): string[] | undefined {
  const list = parseCsv(value);
  return list.length > 0 ? list : undefined;
}

/** Parse an optional integer; throws `Error` for malformed input. */
export function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return parsed;
}

/**
 * Parse the `hiddenAt` option.
 * - undefined → undefined (no change)
 * - 'null' (literal) → null (clear)
 * - anything else → original string (server validates ISO-8601)
 */
export function parseHiddenAt(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value.trim().toLowerCase() === "null") return null;
  return value;
}

/** Parse a JSON object payload from a CLI flag. Throws with a clear message. */
export function parseJsonObject(value: string, fieldName: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    throw new Error(`Invalid ${fieldName} JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/** Build a query string from a record, skipping null/undefined values. */
export function buildQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.append(key, value);
  }
  const out = search.toString();
  return out.length > 0 ? `?${out}` : "";
}

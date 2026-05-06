/**
 * Tiny set of value-coercion primitives shared across gitmesh adapters.
 *
 * These exist so each adapter's stream-event formatter and stdout parser
 * does not have to redefine the same `asRecord` / `asString` helpers.
 * Keep this file dependency-free and trivially tree-shakable.
 */

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as JsonRecord;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown): boolean {
  return value === true;
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Compact a single-line JSON-ish value to a printable string. Falls through to
 * the un-indented form when JSON.stringify works and otherwise to String().
 */
export function stringifyCompact(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Field-order presets for `extractErrorText`. Each adapter has historically
 * tried slightly different fields in slightly different orders; we expose
 * the variants here so the shared helper can preserve the legacy precedence
 * exactly per adapter.
 */
export const ERROR_TEXT_PRESETS = {
  /** opencode: `message` → `data.message` → `name`. */
  opencode: ["message", "data.message", "name"] as const,
  /** codex / claude: `message` → `error` → `code`. */
  codex: ["message", "error", "code"] as const,
  /** Combined catch-all covering every adapter's keys. */
  generic: ["message", "data.message", "error", "name", "code"] as const,
} satisfies Record<string, readonly string[]>;

/**
 * Pull a "human readable" message out of a value that might already be a
 * string, an Error-shaped object (`{message}` / `{error}` / `{code}`), or a
 * nested `{data: {message}}` object. Falls back to JSON-stringifying the
 * object when nothing matches.
 *
 * Pass an explicit `paths` argument (or one of the `ERROR_TEXT_PRESETS`
 * arrays) to control which fields are checked and in what order. Each path
 * may be a top-level key or a single dotted lookup like `"data.message"`.
 */
export function extractErrorText(
  value: unknown,
  paths: readonly string[] = ERROR_TEXT_PRESETS.generic,
): string {
  if (typeof value === "string") return value;
  const rec = asRecord(value);
  if (!rec) return "";
  for (const path of paths) {
    const dot = path.indexOf(".");
    let candidate = "";
    if (dot === -1) {
      candidate = asString(rec[path]);
    } else {
      const head = path.slice(0, dot);
      const tail = path.slice(dot + 1);
      const nested = asRecord(rec[head]);
      candidate = asString(nested?.[tail]);
    }
    if (candidate) return candidate;
  }
  try {
    return JSON.stringify(rec);
  } catch {
    return "";
  }
}

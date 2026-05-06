/**
 * Normalizes a hostname string.
 * Accepts a bare hostname or one with a scheme; always returns just the hostname part, lowercased.
 */
export function normalizeHostnameInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Hostname is required");

  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = url.hostname.trim().toLowerCase();
    if (!host) throw new Error("Hostname is required");
    return host;
  } catch {
    throw new Error(`Invalid hostname: ${raw}`);
  }
}

/**
 * Parses a comma-separated list of hostnames, returning deduplicated normalized entries.
 */
export function parseHostnameCsv(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  for (const token of trimmed.split(",")) {
    const normalized = normalizeHostnameInput(token);
    if (!seen.has(normalized)) seen.add(normalized);
  }
  return Array.from(seen);
}

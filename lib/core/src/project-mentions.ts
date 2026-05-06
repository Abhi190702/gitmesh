/**
 * Project mention parsing and formatting.
 *
 * Project mentions are links embedded in markdown of the form:
 *   [My Project](project://project-slug?c=a1b2c3)
 *
 * The scheme is used throughout GitMesh Agents UI and API responses
 * to link projects without coupling to specific hostnames.
 */

export const PROJECT_MENTION_SCHEME = "project://";

const FULL_HEX_RE = /^[0-9a-f]{6}$/i;
const SHORT_HEX_RE = /^[0-9a-f]{3}$/i;
const FULL_HASH_RE = /^#[0-9a-f]{6}$/i;
const SHORT_HASH_RE = /^#[0-9a-f]{3}$/i;
const MARKDOWN_LINK_RE = /\[[^\]]*]\((project:\/\/[^)\s]+)\)/gi;

export interface ProjectMention {
  projectId: string;
  color: string | null;
}

/**
 * Expand a 3-digit hex color to 6-digit, adding a # prefix.
 * Returns null if the input is not a valid short hex color.
 */
function expandShortColor(raw: string): string | null {
  if (!SHORT_HASH_RE.test(raw) && !SHORT_HEX_RE.test(raw)) return null;
  const hex = raw.replace(/^#/, "");
  return "#" + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
}

/**
 * Normalize a color string to a 6-digit lowercase hex color with # prefix.
 * Returns null if the input is not a valid color.
 */
function normalizeColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (FULL_HASH_RE.test(trimmed)) return trimmed.toLowerCase();
  if (FULL_HEX_RE.test(trimmed)) return "#" + trimmed.toLowerCase();
  return expandShortColor(trimmed);
}

/**
 * Build a project:// URI from a project ID and optional color.
 */
export function buildProjectMentionHref(projectId: string, color?: string | null): string {
  const id = projectId.trim();
  const c = normalizeColor(color ?? null);
  return c ? `${PROJECT_MENTION_SCHEME}${id}?c=${encodeURIComponent(c.slice(1))}` : `${PROJECT_MENTION_SCHEME}${id}`;
}

/**
 * Parse a project:// URI into its components.
 * Returns null if the URI is malformed.
 */
export function parseProjectMentionHref(href: string): ProjectMention | null {
  if (!href.startsWith(PROJECT_MENTION_SCHEME)) return null;

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }

  if (parsed.protocol !== "project:") return null;

  // Hostname + pathname form the project ID
  const id = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, "").trim();
  if (!id) return null;

  const color =
    normalizeColor(parsed.searchParams.get("c") ?? null) ??
    normalizeColor(parsed.searchParams.get("color") ?? null);

  return { projectId: id, color };
}

/**
 * Extract all project IDs mentioned in a markdown string.
 */
export function extractProjectMentionIds(markdown: string): string[] {
  if (!markdown) return [];
  const found = new Set<string>();
  const re = new RegExp(MARKDOWN_LINK_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const parsed = parseProjectMentionHref(match[1]);
    if (parsed) found.add(parsed.projectId);
  }
  return [...found];
}

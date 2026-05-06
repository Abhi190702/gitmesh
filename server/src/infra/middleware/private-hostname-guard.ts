/**
 * Private-hostname guard, expressed as composed predicates.
 *
 * The guard only allows requests whose Host (or X-Forwarded-Host) header
 * resolves to an explicitly allow-listed hostname, plus loopback. Two
 * predicate-specs are composed: the first rejects requests that are missing
 * a hostname entirely, the second rejects unknown hostnames.
 */
import type { Request, RequestHandler } from "express";
import { composeGuards, negotiateContentType } from "./_compose.js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.trim().toLowerCase());
}

function extractHostname(req: Request): string | null {
  const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = req.header("host")?.trim();
  const raw = forwardedHost || hostHeader;
  if (!raw) return null;
  try {
    return new URL(`http://${raw}`).hostname.trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function normalizeAllowedHostnames(values: string[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

export function resolvePrivateHostnameAllowSet(opts: {
  allowedHostnames: string[];
  bindHost: string;
}): Set<string> {
  const allowSet = new Set<string>(normalizeAllowedHostnames(opts.allowedHostnames));
  const bindHost = opts.bindHost.trim().toLowerCase();
  if (bindHost && bindHost !== "0.0.0.0") {
    allowSet.add(bindHost);
  }
  for (const loopback of LOOPBACK_HOSTS) {
    allowSet.add(loopback);
  }
  return allowSet;
}

const MISSING_HOST_MESSAGE =
  "Missing Host header. If you want to allow a hostname, run pnpm gitmesh-agents allowed-hostname <host>.";

function blockedHostnameMessage(hostname: string): string {
  return (
    `Hostname '${hostname}' is not allowed for this GitMesh Agents instance. ` +
    `If you want to allow this hostname, please run pnpm gitmesh-agents allowed-hostname ${hostname}`
  );
}

export function privateHostnameGuard(opts: {
  enabled: boolean;
  allowedHostnames: string[];
  bindHost: string;
}): RequestHandler {
  if (!opts.enabled) {
    return (_req, _res, next) => next();
  }

  const allowSet = resolvePrivateHostnameAllowSet({
    allowedHostnames: opts.allowedHostnames,
    bindHost: opts.bindHost,
  });

  // Two predicate guards composed in order: (a) a Host header must be
  // present, (b) it must be loopback or in the allow set. The first failure
  // wins, producing the appropriate human-readable message.
  return composeGuards(
    {
      name: "private-hostname-guard:require-host",
      check: (req) => extractHostname(req) !== null,
      deny: (req) => ({
        status: 403,
        error: MISSING_HOST_MESSAGE,
        contentType: negotiateContentType(req),
      }),
    },
    {
      name: "private-hostname-guard:allow-list",
      check: (req) => {
        const hostname = extractHostname(req);
        if (!hostname) return true; // first guard already rejected
        return isLoopbackHostname(hostname) || allowSet.has(hostname);
      },
      deny: (req) => {
        const hostname = extractHostname(req) ?? "<unknown>";
        return {
          status: 403,
          error: blockedHostnameMessage(hostname),
          contentType: negotiateContentType(req),
        };
      },
    },
  );
}

/**
 * Operator-mutation guard, expressed as a composed predicate.
 *
 * Operators with an active session may only mutate state when the request
 * originates from a trusted browser origin (CSRF defense). The guard is
 * implemented on top of the `defineGuard` predicate-spec helper so the
 * "should we run", "does it pass" and "how do we deny" axes are explicit.
 */
import type { Request, RequestHandler } from "express";
import { defineGuard, isMutating } from "./_compose.js";

const DEV_TRUSTED_ORIGINS = ["http://localhost:3100", "http://127.0.0.1:3100"];

interface ParsedOrigin {
  raw: string;
  normalized: string;
}

function parseOrigin(value: string | undefined | null): ParsedOrigin | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return { raw, normalized: `${url.protocol}//${url.host}`.toLowerCase() };
  } catch {
    return null;
  }
}

function trustedOriginsFor(req: Request): Set<string> {
  const allowed = new Set<string>();
  for (const dev of DEV_TRUSTED_ORIGINS) allowed.add(dev.toLowerCase());

  const host = req.header("host")?.trim();
  if (host) {
    allowed.add(`http://${host}`.toLowerCase());
    allowed.add(`https://${host}`.toLowerCase());
  }
  return allowed;
}

function originMatchesTrusted(req: Request): boolean {
  const allowed = trustedOriginsFor(req);
  const origin = parseOrigin(req.header("origin"));
  if (origin && allowed.has(origin.normalized)) return true;
  const referer = parseOrigin(req.header("referer"));
  if (referer && allowed.has(referer.normalized)) return true;
  return false;
}

/**
 * Predicate: does this request need the guard at all?
 * - Skip safe (read) methods.
 * - Skip non-operator actors (agents have their own auth path).
 * - Skip the implicit local-board operator in `local_trusted` mode, where
 *   the browser may omit Origin/Referer for multipart uploads.
 */
function guardAppliesTo(req: Request): boolean {
  if (!isMutating(req)) return false;
  if (req.actor.type !== "operator") return false;
  if (req.actor.source === "local_implicit") return false;
  return true;
}

export function operatorMutationGuard(): RequestHandler {
  return defineGuard({
    name: "operator-mutation-guard",
    when: guardAppliesTo,
    check: originMatchesTrusted,
    deny: () => ({
      status: 403,
      error: "Operator mutation requires trusted browser origin",
    }),
  });
}

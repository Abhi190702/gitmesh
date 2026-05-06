/**
 * Embedded PostgreSQL lifecycle helpers used by the bootstrap path.
 *
 * Encapsulates the initialise/start dance, stale lock-file cleanup, and
 * a small log buffer for diagnosing failures without spamming the console
 * on the happy path.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "../infra/middleware/logger.js";

export type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

export type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

const LOG_BUFFER_LIMIT = 120;

export function createEmbeddedPostgresLogBuffer(): {
  append: (message: unknown) => void;
  contents: () => string[];
} {
  const buffer: string[] = [];
  const verbose = process.env.GITMESH_EMBEDDED_POSTGRES_VERBOSE === "true";

  return {
    append(message) {
      const text =
        typeof message === "string"
          ? message
          : message instanceof Error
            ? message.message
            : String(message ?? "");
      for (const lineRaw of text.split(/\r?\n/)) {
        const line = lineRaw.trim();
        if (!line) continue;
        buffer.push(line);
        if (buffer.length > LOG_BUFFER_LIMIT) {
          buffer.splice(0, buffer.length - LOG_BUFFER_LIMIT);
        }
        if (verbose) {
          logger.info({ embeddedPostgresLog: line }, "embedded-postgres");
        }
      }
    },
    contents() {
      return [...buffer];
    },
  };
}

export function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readPostmasterPid(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const pidLine = readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim();
    const pid = Number(pidLine);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    if (!isPidRunning(pid)) return null;
    return pid;
  } catch {
    return null;
  }
}

export function clearStalePostmasterLock(dataDir: string): void {
  const postmasterPidFile = resolve(dataDir, "postmaster.pid");
  if (existsSync(postmasterPidFile)) {
    logger.warn("Removing stale embedded PostgreSQL lock file");
    rmSync(postmasterPidFile, { force: true });
  }
}

export async function loadEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  const moduleName = "embedded-postgres";
  try {
    const mod = await import(moduleName);
    return mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "Embedded PostgreSQL mode requires dependency `embedded-postgres`. Reinstall dependencies (without omitting required packages), or set DATABASE_URL for external Postgres.",
    );
  }
}

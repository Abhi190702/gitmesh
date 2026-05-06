/// <reference path="./types/express.d.ts" />
/**
 * GitMesh Agents server bootstrap entrypoint.
 *
 * The bootstrap composes a sequence of boot-step modules under `./boot/*`
 * (database, embedded postgres, migrations, scheduled tasks, local-trusted
 * principal seeding). This file orchestrates them in order and starts the
 * HTTP listener.
 */
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import type { Request as ExpressRequest, RequestHandler } from "express";
import { createDb, ensurePostgresDatabase } from "@gitmesh/data";
import detectPort from "detect-port";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { logger } from "./infra/middleware/logger.js";
import { setupLiveEventsWebSocketServer } from "./infra/realtime/live-events-ws.js";
import { createStorageServiceFromConfig } from "./infra/storage/index.js";
import { printStartupBanner } from "./startup-banner.js";
import {
  getOperatorClaimWarningUrl,
  initializeOperatorClaimChallenge,
} from "./operator-claim.js";
import { ensureMigrations, type MigrationSummary } from "./boot/migrations.js";
import {
  ensureLocalTrustedBoardPrincipal,
  isLoopbackHost,
} from "./boot/local-trusted.js";
import {
  clearStalePostmasterLock,
  createEmbeddedPostgresLogBuffer,
  loadEmbeddedPostgresCtor,
  readPostmasterPid,
  type EmbeddedPostgresInstance,
} from "./boot/embedded-postgres.js";
import {
  seedDefaultProjectTemplates,
  startAttestationWorker,
  startDatabaseBackupScheduler,
  startHeartbeatScheduler,
} from "./boot/scheduled-tasks.js";

type BetterAuthSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

type BetterAuthSessionResult = {
  session: { id: string; userId: string } | null;
  user: BetterAuthSessionUser | null;
};

// ---------------------------------------------------------------------------
// 1. Load config and propagate secret-provider env defaults.
// ---------------------------------------------------------------------------
const config = loadConfig();
if (process.env.GITMESH_SECRETS_PROVIDER === undefined) {
  process.env.GITMESH_SECRETS_PROVIDER = config.secretsProvider;
}
if (process.env.GITMESH_SECRETS_STRICT_MODE === undefined) {
  process.env.GITMESH_SECRETS_STRICT_MODE = config.secretsStrictMode ? "true" : "false";
}
if (process.env.GITMESH_SECRETS_MASTER_KEY_FILE === undefined) {
  process.env.GITMESH_SECRETS_MASTER_KEY_FILE = config.secretsMasterKeyFilePath;
}

// ---------------------------------------------------------------------------
// 2. Bring up the database (external PG or embedded), apply migrations.
// ---------------------------------------------------------------------------
let db;
let embeddedPostgres: EmbeddedPostgresInstance | null = null;
let embeddedPostgresStartedByThisProcess = false;
let migrationSummary: MigrationSummary = "skipped";
let activeDatabaseConnectionString: string;
let startupDbInfo:
  | { mode: "external-postgres"; connectionString: string }
  | { mode: "embedded-postgres"; dataDir: string; port: number };

if (config.databaseUrl) {
  migrationSummary = await ensureMigrations(config.databaseUrl, "PostgreSQL");
  db = createDb(config.databaseUrl);
  logger.info("Using external PostgreSQL via DATABASE_URL/config");
  activeDatabaseConnectionString = config.databaseUrl;
  startupDbInfo = { mode: "external-postgres", connectionString: config.databaseUrl };
} else {
  const EmbeddedPostgres = await loadEmbeddedPostgresCtor();
  const dataDir = resolve(config.embeddedPostgresDataDir);
  const configuredPort = config.embeddedPostgresPort;
  let port = configuredPort;
  const logBuffer = createEmbeddedPostgresLogBuffer();
  const logEmbeddedPostgresFailure = (phase: "initialise" | "start", err: unknown) => {
    const recentLogs = logBuffer.contents();
    if (recentLogs.length > 0) {
      logger.error(
        { phase, recentLogs, err },
        "Embedded PostgreSQL failed; showing buffered startup logs",
      );
    }
  };

  if (config.databaseMode === "postgres") {
    logger.warn(
      "Database mode is postgres but no connection string was set; falling back to embedded PostgreSQL",
    );
  }

  const clusterVersionFile = resolve(dataDir, "PG_VERSION");
  const clusterAlreadyInitialized = existsSync(clusterVersionFile);
  const postmasterPidFile = resolve(dataDir, "postmaster.pid");
  const runningPid = readPostmasterPid(postmasterPidFile);

  if (runningPid) {
    logger.warn(
      `Embedded PostgreSQL already running; reusing existing process (pid=${runningPid}, port=${port})`,
    );
  } else {
    const detectedPort = await detectPort(configuredPort);
    if (detectedPort !== configuredPort) {
      logger.warn(
        `Embedded PostgreSQL port is in use; using next free port (requestedPort=${configuredPort}, selectedPort=${detectedPort})`,
      );
    }
    port = detectedPort;
    logger.info(`Using embedded PostgreSQL because no DATABASE_URL set (dataDir=${dataDir}, port=${port})`);

    embeddedPostgres = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "gitmesh",
      password: "gitmesh",
      port,
      persistent: true,
      onLog: logBuffer.append,
      onError: logBuffer.append,
    });

    if (!clusterAlreadyInitialized) {
      try {
        await embeddedPostgres.initialise();
      } catch (err) {
        logEmbeddedPostgresFailure("initialise", err);
        throw err;
      }
    } else {
      logger.info(
        `Embedded PostgreSQL cluster already exists (${clusterVersionFile}); skipping init`,
      );
    }

    clearStalePostmasterLock(dataDir);
    try {
      await embeddedPostgres.start();
    } catch (err) {
      logEmbeddedPostgresFailure("start", err);
      throw err;
    }
    embeddedPostgresStartedByThisProcess = true;
  }

  const embeddedAdminConnectionString = `postgres://gitmesh:gitmesh@127.0.0.1:${port}/postgres`;
  const dbStatus = await ensurePostgresDatabase(embeddedAdminConnectionString, "gitmesh");
  if (dbStatus === "created") {
    logger.info("Created embedded PostgreSQL database: gitmesh");
  }

  const embeddedConnectionString = `postgres://gitmesh:gitmesh@127.0.0.1:${port}/gitmesh`;
  const shouldAutoApplyFirstRunMigrations = !clusterAlreadyInitialized || dbStatus === "created";
  if (shouldAutoApplyFirstRunMigrations) {
    logger.info(
      "Detected first-run embedded PostgreSQL setup; applying pending migrations automatically",
    );
  }
  migrationSummary = await ensureMigrations(embeddedConnectionString, "Embedded PostgreSQL", {
    autoApply: shouldAutoApplyFirstRunMigrations,
  });

  db = createDb(embeddedConnectionString);
  logger.info("Embedded PostgreSQL ready");
  activeDatabaseConnectionString = embeddedConnectionString;
  startupDbInfo = { mode: "embedded-postgres", dataDir, port };
}

// ---------------------------------------------------------------------------
// 3. Validate deployment-mode invariants.
// ---------------------------------------------------------------------------
if (config.deploymentMode === "local_trusted" && !isLoopbackHost(config.host)) {
  throw new Error(
    `local_trusted mode requires loopback host binding (received: ${config.host}). ` +
      "Use authenticated mode for non-loopback deployments.",
  );
}
if (config.deploymentMode === "local_trusted" && config.deploymentExposure !== "private") {
  throw new Error("local_trusted mode only supports private exposure");
}
if (config.deploymentMode === "authenticated") {
  if (config.authBaseUrlMode === "explicit" && !config.authPublicBaseUrl) {
    throw new Error("auth.baseUrlMode=explicit requires auth.publicBaseUrl");
  }
  if (config.deploymentExposure === "public") {
    if (config.authBaseUrlMode !== "explicit") {
      throw new Error("authenticated public exposure requires auth.baseUrlMode=explicit");
    }
    if (!config.authPublicBaseUrl) {
      throw new Error("authenticated public exposure requires auth.publicBaseUrl");
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Resolve auth handler / session resolvers based on deployment mode.
// ---------------------------------------------------------------------------
let authReady = config.deploymentMode === "local_trusted";
let betterAuthHandler: RequestHandler | undefined;
let resolveSession:
  | ((req: ExpressRequest) => Promise<BetterAuthSessionResult | null>)
  | undefined;
let resolveSessionFromHeaders:
  | ((headers: Headers) => Promise<BetterAuthSessionResult | null>)
  | undefined;

if (config.deploymentMode === "local_trusted") {
  await ensureLocalTrustedBoardPrincipal(db as any);
}

if (config.deploymentMode === "authenticated") {
  const {
    createBetterAuthHandler,
    createBetterAuthInstance,
    deriveAuthTrustedOrigins,
    resolveBetterAuthSession,
    resolveBetterAuthSessionFromHeaders,
  } = await import("./infra/auth/better-auth.js");
  const betterAuthSecret =
    process.env.BETTER_AUTH_SECRET?.trim() ?? process.env.GITMESH_AGENT_JWT_SECRET?.trim();
  if (!betterAuthSecret) {
    throw new Error(
      "authenticated mode requires BETTER_AUTH_SECRET (or GITMESH_AGENT_JWT_SECRET) to be set",
    );
  }
  const derivedTrustedOrigins = deriveAuthTrustedOrigins(config);
  const envTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const effectiveTrustedOrigins = Array.from(
    new Set([...derivedTrustedOrigins, ...envTrustedOrigins]),
  );
  logger.info(
    {
      authBaseUrlMode: config.authBaseUrlMode,
      authPublicBaseUrl: config.authPublicBaseUrl ?? null,
      trustedOrigins: effectiveTrustedOrigins,
      trustedOriginsSource: {
        derived: derivedTrustedOrigins.length,
        env: envTrustedOrigins.length,
      },
    },
    "Authenticated mode auth origin configuration",
  );
  const auth = createBetterAuthInstance(db as any, config, effectiveTrustedOrigins);
  betterAuthHandler = createBetterAuthHandler(auth);
  resolveSession = (req) => resolveBetterAuthSession(auth, req);
  resolveSessionFromHeaders = (headers) => resolveBetterAuthSessionFromHeaders(auth, headers);
  await initializeOperatorClaimChallenge(db as any, { deploymentMode: config.deploymentMode });
  authReady = true;
}

// ---------------------------------------------------------------------------
// 5. Build the Express app and HTTP server.
// ---------------------------------------------------------------------------
const uiMode = config.uiDevMiddleware ? "vite-dev" : config.serveUi ? "static" : "none";
const storageService = createStorageServiceFromConfig(config);
const app = await createApp(db as any, {
  uiMode,
  storageService,
  deploymentMode: config.deploymentMode,
  deploymentExposure: config.deploymentExposure,
  allowedHostnames: config.allowedHostnames,
  bindHost: config.host,
  authReady,
  projectDeletionEnabled: config.projectDeletionEnabled,
  betterAuthHandler,
  resolveSession,
  githubOAuthConfigured: Boolean(config.gitHubClientId && config.gitHubClientSecret),
});
const server = createServer(app as unknown as Parameters<typeof createServer>[0]);
const listenPort = await detectPort(config.port);

if (listenPort !== config.port) {
  logger.warn(
    `Requested port is busy; using next free port (requestedPort=${config.port}, selectedPort=${listenPort})`,
  );
}

const runtimeListenHost = config.host;
const runtimeApiHost =
  runtimeListenHost === "0.0.0.0" || runtimeListenHost === "::"
    ? "localhost"
    : runtimeListenHost;
process.env.GITMESH_LISTEN_HOST = runtimeListenHost;
process.env.GITMESH_LISTEN_PORT = String(listenPort);
process.env.GITMESH_API_URL = `http://${runtimeApiHost}:${listenPort}`;

setupLiveEventsWebSocketServer(server, db as any, {
  deploymentMode: config.deploymentMode,
  resolveSessionFromHeaders,
});

// ---------------------------------------------------------------------------
// 6. Start background schedulers and seeders.
// ---------------------------------------------------------------------------
startHeartbeatScheduler(db, {
  enabled: config.heartbeatSchedulerEnabled,
  intervalMs: config.heartbeatSchedulerIntervalMs,
});

await seedDefaultProjectTemplates(db);
await startAttestationWorker(db);

startDatabaseBackupScheduler({
  enabled: config.databaseBackupEnabled,
  intervalMinutes: config.databaseBackupIntervalMinutes,
  retentionDays: config.databaseBackupRetentionDays,
  backupDir: config.databaseBackupDir,
  connectionString: activeDatabaseConnectionString,
});

// ---------------------------------------------------------------------------
// 7. Listen and print the startup banner.
// ---------------------------------------------------------------------------
server.listen(listenPort, config.host, () => {
  logger.info(`Server listening on ${config.host}:${listenPort}`);
  if (process.env.GITMESH_OPEN_ON_LISTEN === "true") {
    const openHost = config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host;
    const url = `http://${openHost}:${listenPort}`;
    void import("open")
      .then((mod) => mod.default(url))
      .then(() => {
        logger.info(`Opened browser at ${url}`);
      })
      .catch((err) => {
        logger.warn({ err, url }, "Failed to open browser on startup");
      });
  }
  printStartupBanner({
    host: config.host,
    deploymentMode: config.deploymentMode,
    deploymentExposure: config.deploymentExposure,
    authReady,
    requestedPort: config.port,
    listenPort,
    uiMode,
    db: startupDbInfo,
    migrationSummary,
    heartbeatSchedulerEnabled: config.heartbeatSchedulerEnabled,
    heartbeatSchedulerIntervalMs: config.heartbeatSchedulerIntervalMs,
    databaseBackupEnabled: config.databaseBackupEnabled,
    databaseBackupIntervalMinutes: config.databaseBackupIntervalMinutes,
    databaseBackupRetentionDays: config.databaseBackupRetentionDays,
    databaseBackupDir: config.databaseBackupDir,
  });

  const boardClaimUrl = getOperatorClaimWarningUrl(config.host, listenPort);
  if (boardClaimUrl) {
    const red = "\x1b[41m\x1b[30m";
    const yellow = "\x1b[33m";
    const reset = "\x1b[0m";
    console.log(
      [
        `${red}  MAINTAINER CLAIM REQUIRED  ${reset}`,
        `${yellow}This instance was previously local_trusted and still has local-board as the only admin.${reset}`,
        `${yellow}Sign in with a real user and open this one-time URL to claim ownership:${reset}`,
        `${yellow}${boardClaimUrl}${reset}`,
        `${yellow}If you are connecting over Tailscale, replace the host in this URL with your Tailscale IP/MagicDNS name.${reset}`,
      ].join("\n"),
    );
  }
});

// ---------------------------------------------------------------------------
// 8. Graceful shutdown for embedded PostgreSQL.
// ---------------------------------------------------------------------------
if (embeddedPostgres && embeddedPostgresStartedByThisProcess) {
  const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
    logger.info({ signal }, "Stopping embedded PostgreSQL");
    try {
      await embeddedPostgres?.stop();
    } catch (err) {
      logger.error({ err }, "Failed to stop embedded PostgreSQL cleanly");
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

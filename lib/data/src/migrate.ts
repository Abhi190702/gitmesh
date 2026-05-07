import { applyPendingMigrations, inspectMigrations } from "./client.js";
import { resolveDatabaseUrl } from "./database-url.js";

const url = resolveDatabaseUrl();

const before = await inspectMigrations(url);
if (before.status === "upToDate") {
  console.log("No pending migrations");
} else {
  console.log(`Applying ${before.pendingMigrations.length} pending migration(s)...`);
  await applyPendingMigrations(url);

  const after = await inspectMigrations(url);
  if (after.status !== "upToDate") {
    throw new Error(`Migrations incomplete: ${after.pendingMigrations.join(", ")}`);
  }
  console.log("Migrations complete");
}

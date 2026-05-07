import { createHash } from "node:crypto";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as drizzleMigrate } from "drizzle-orm/postgres-js/migrator";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));
const DRIZZLE_TABLE = "__drizzle_migrations";
const JOURNAL_FILE = fileURLToPath(new URL("./migrations/meta/_journal.json", import.meta.url));

// ── SQL quoting helpers ────────────────────────────────────────────────────

function safeIdentifier(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function quoteId(value: string): string {
  if (!safeIdentifier(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteVal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

// ── Migration file handling ───────────────────────────────────────────────

function splitStatements(content: string): string[] {
  return content
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function collectMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

// ── Journal parsing ──────────────────────────────────────────────────────

type JournalEntry = { idx?: number; tag?: string; when?: number };

type ResolvedJournalEntry = {
  fileName: string;
  folderMillis: number;
  order: number;
};

async function parseJournalEntries(): Promise<ResolvedJournalEntry[]> {
  try {
    const raw = await readFile(JOURNAL_FILE, "utf8");
    const parsed = JSON.parse(raw) as { entries?: JournalEntry[] };
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries
      .map((entry, entryIndex): ResolvedJournalEntry | null => {
        if (typeof entry?.tag !== "string") return null;
        if (typeof entry?.when !== "number" || !Number.isFinite(entry.when)) return null;
        const order = Number.isInteger(entry.idx) ? Number(entry.idx) : entryIndex;
        return { fileName: `${entry.tag}.sql`, folderMillis: entry.when, order };
      })
      .filter((e): e is ResolvedJournalEntry => e !== null);
  } catch {
    return [];
  }
}

async function journalFileNames(): Promise<string[]> {
  return (await parseJournalEntries()).map((e) => e.fileName);
}

async function readFileContent(file: string): Promise<string> {
  return readFile(new URL(`./migrations/${file}`, import.meta.url), "utf8");
}

// ── Migration ordering ────────────────────────────────────────────────────

async function orderMigrations(files: string[]): Promise<string[]> {
  const entries = await parseJournalEntries();
  const orderMap = new Map(entries.map((e) => [e.fileName, e.order]));
  return [...files].sort((a, b) => {
    const oa = orderMap.get(a);
    const ob = orderMap.get(b);
    if (oa === undefined && ob === undefined) return a.localeCompare(b);
    if (oa === undefined) return 1;
    if (ob === undefined) return -1;
    if (oa === ob) return a.localeCompare(b);
    return oa - ob;
  });
}

// ── Transaction helper ───────────────────────────────────────────────────

type Sql = Pick<ReturnType<typeof postgres>, "unsafe">;

async function withTransaction(sql: Sql, fn: () => Promise<void>): Promise<void> {
  await sql.unsafe("BEGIN");
  try {
    await fn();
    await sql.unsafe("COMMIT");
  } catch (err) {
    try { await sql.unsafe("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  }
}

// ── Migration table discovery ─────────────────────────────────────────────

async function findMigrationTableSchema(sql: ReturnType<typeof postgres>): Promise<string | null> {
  const rows = await sql<{ schemaName: string }[]>`
    SELECT n.nspname AS "schemaName"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = ${DRIZZLE_TABLE} AND c.relkind = 'r'
  `;
  if (rows.length === 0) return null;
  const bySchema = (s: string) => rows.find(({ schemaName }) => schemaName === s);
  return bySchema("drizzle")?.schemaName
    ?? bySchema("public")?.schemaName
    ?? rows[0]?.schemaName
    ?? null;
}

// ── Column introspection ──────────────────────────────────────────────────

async function getColumnNames(
  sql: ReturnType<typeof postgres>,
  tableSchema: string,
): Promise<Set<string>> {
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = ${tableSchema}
      AND table_name = ${DRIZZLE_TABLE}
  `;
  return new Set(rows.map((r) => r.column_name));
}

async function tableExists(sql: ReturnType<typeof postgres>, tableName: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

async function columnExists(
  sql: ReturnType<typeof postgres>,
  tableName: string,
  colName: string,
): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name = ${colName}
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

async function indexExists(sql: ReturnType<typeof postgres>, indexName: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname = ${indexName}
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

async function constraintExists(sql: ReturnType<typeof postgres>, conName: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.conname = ${conName}
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

// ── Statement-level applied check ────────────────────────────────────────

async function statementApplied(sql: ReturnType<typeof postgres>, stmt: string): Promise<boolean> {
  const normalized = stmt.replace(/\s+/g, " ").trim();

  const createTable = normalized.match(/^CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)"/i);
  if (createTable) return tableExists(sql, createTable[1]);

  const addCol = normalized.match(/^ALTER TABLE "([^"]+)" ADD COLUMN(?: IF NOT EXISTS)? "([^"]+)"/i);
  if (addCol) return columnExists(sql, addCol[1], addCol[2]);

  const createIdx = normalized.match(/^CREATE (?:UNIQUE )?INDEX(?: IF NOT EXISTS)? "([^"]+)"/i);
  if (createIdx) return indexExists(sql, createIdx[1]);

  const addCon = normalized.match(/^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)"/i);
  if (addCon) return constraintExists(sql, addCon[2]);

  return false;
}

async function migrationApplied(sql: ReturnType<typeof postgres>, content: string): Promise<boolean> {
  const stmts = splitStatements(content);
  if (stmts.length === 0) return false;
  for (const stmt of stmts) {
    if (!(await statementApplied(sql, stmt))) return false;
  }
  return true;
}

// ── Migration history ────────────────────────────────────────────────────

async function latestCreatedAt(sql: Sql, qualifiedTable: string): Promise<number | null> {
  const rows = await sql.unsafe<{ created_at: string | number | null }[]>(
    `SELECT created_at FROM ${qualifiedTable} ORDER BY created_at DESC NULLS LAST LIMIT 1`,
  );
  const value = Number(rows[0]?.created_at ?? Number.NaN);
  return Number.isFinite(value) ? value : null;
}

function normalizeMillis(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.trunc(value);
  return Date.now();
}

async function historyEntryExists(
  sql: Sql,
  qualifiedTable: string,
  colNames: Set<string>,
  file: string,
  hash: string,
): Promise<boolean> {
  const preds: string[] = [];
  if (colNames.has("hash")) preds.push(`hash = ${quoteVal(hash)}`);
  if (colNames.has("name")) preds.push(`name = ${quoteVal(file)}`);
  if (preds.length === 0) return false;
  const rows = await sql.unsafe<{ one: number }[]>(
    `SELECT 1 AS one FROM ${qualifiedTable} WHERE ${preds.join(" OR ")} LIMIT 1`,
  );
  return rows.length > 0;
}

async function insertHistoryEntry(
  sql: Sql,
  qualifiedTable: string,
  colNames: Set<string>,
  file: string,
  hash: string,
  folderMillis: number,
): Promise<void> {
  const cols: string[] = [];
  const vals: string[] = [];

  if (colNames.has("hash")) { cols.push(quoteId("hash")); vals.push(quoteVal(hash)); }
  if (colNames.has("name")) { cols.push(quoteId("name")); vals.push(quoteVal(file)); }
  if (colNames.has("created_at")) {
    const latest = await latestCreatedAt(sql, qualifiedTable);
    const createdAt = latest === null
      ? normalizeMillis(folderMillis)
      : Math.max(latest + 1, normalizeMillis(folderMillis));
    cols.push(quoteId("created_at"));
    vals.push(quoteVal(String(createdAt)));
  }

  if (cols.length === 0) return;
  await sql.unsafe(`INSERT INTO ${qualifiedTable} (${cols.join(", ")}) VALUES (${vals.join(", ")})`);
}

// ── Hash utilities ───────────────────────────────────────────────────────

async function hashFile(file: string): Promise<string> {
  const content = await readFileContent(file);
  return createHash("sha256").update(content).digest("hex");
}

async function hashMap(files: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(files.map(async (f) => map.set(await hashFile(f), f)));
  return map;
}

// ── Migration table setup ─────────────────────────────────────────────────

async function ensureMigrationTable(sql: ReturnType<typeof postgres>): Promise<{ schema: string; cols: Set<string> }> {
  let schema = await findMigrationTableSchema(sql);
  if (!schema) {
    const drizzle = quoteId("drizzle");
    const table = quoteId(DRIZZLE_TABLE);
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${drizzle}`);
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS ${drizzle}.${table} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    );
    schema = (await findMigrationTableSchema(sql)) ?? "drizzle";
  }
  return { schema, cols: await getColumnNames(sql, schema) };
}

// ── Load applied migrations ───────────────────────────────────────────────

async function loadApplied(
  sql: ReturnType<typeof postgres>,
  tableSchema: string,
  available: string[],
): Promise<string[]> {
  const qualified = `${quoteId(tableSchema)}.${quoteId(DRIZZLE_TABLE)}`;
  const colNames = await getColumnNames(sql, tableSchema);

  if (colNames.has("name")) {
    const rows = await sql.unsafe<{ name: string }[]>(`SELECT name FROM ${qualified} ORDER BY id`);
    return rows.map((r) => r.name).filter((n): n is string => Boolean(n));
  }

  if (colNames.has("hash")) {
    const hashToFile = await hashMap(available);
    const rows = await sql.unsafe<{ hash: string }[]>(`SELECT hash FROM ${qualified} ORDER BY id`);
    const resolved = rows.map((r) => hashToFile.get(r.hash)).filter((n): n is string => Boolean(n));
    if (resolved.length > 0) {
      return resolved.length === rows.length ? resolved : resolved;
    }
    if (colNames.has("created_at")) {
      const entries = await parseJournalEntries();
      if (entries.length > 0) {
        const lastRows = await sql.unsafe<{ created_at: string | number | null }[]>(
          `SELECT created_at FROM ${qualified} ORDER BY created_at DESC LIMIT 1`,
        );
        const lastCreatedAt = Number(lastRows[0]?.created_at ?? -1);
        if (Number.isFinite(lastCreatedAt) && lastCreatedAt >= 0) {
          return entries
            .filter((e) => available.includes(e.fileName))
            .filter((e) => e.folderMillis <= lastCreatedAt)
            .map((e) => e.fileName)
            .slice(0, rows.length);
        }
      }
    }
  }

  const rows = await sql.unsafe<{ id: number }[]>(`SELECT id FROM ${qualified} ORDER BY id`);
  const journalFiles = await journalFileNames();
  const byId = rows.map((r) => journalFiles[r.id - 1]).filter((n): n is string => Boolean(n));
  if (byId.length > 0) return byId;

  return available.slice(0, Math.max(0, rows.length));
}

// ── Manual migration runner ───────────────────────────────────────────────

async function runMigrationsManually(url: string, pending: string[]): Promise<void> {
  if (pending.length === 0) return;

  const ordered = await orderMigrations(pending);
  const entries = await parseJournalEntries();
  const millisByFile = new Map(entries.map((e) => [e.fileName, normalizeMillis(e.folderMillis)]));

  const sql = postgres(url, { max: 1 });
  try {
    const { schema, cols } = await ensureMigrationTable(sql);
    const qualified = `${quoteId(schema)}.${quoteId(DRIZZLE_TABLE)}`;

    for (const file of ordered) {
      const content = await readFileContent(file);
      const hash = createHash("sha256").update(content).digest("hex");
      if (await historyEntryExists(sql, qualified, cols, file, hash)) continue;

      await withTransaction(sql, async () => {
        for (const stmt of splitStatements(content)) {
          await sql.unsafe(stmt);
        }
        await insertHistoryEntry(sql, qualified, cols, file, hash, millisByFile.get(file) ?? Date.now());
      });
    }
  } finally {
    await sql.end();
  }
}

// ── Public types ─────────────────────────────────────────────────────────

export type MigrationState =
  | { status: "upToDate"; tableCount: number; availableMigrations: string[]; appliedMigrations: string[] }
  | {
      status: "needsMigrations";
      tableCount: number;
      availableMigrations: string[];
      appliedMigrations: string[];
      pendingMigrations: string[];
      reason: "no-migration-journal-empty-db" | "no-migration-journal-non-empty-db" | "pending-migrations";
    };

export type ReconcileResult = { repairedMigrations: string[]; remainingMigrations: string[] };
export type MigrationHistoryReconcileResult = ReconcileResult;
export type MigrationBootstrapResult = BootstrapResult;

// ── DB factory ───────────────────────────────────────────────────────────

export function createDb(url: string) {
  const sql = postgres(url);
  return drizzlePg(sql, { schema });
}

// ── Inspection ───────────────────────────────────────────────────────────

export async function inspectMigrations(url: string): Promise<MigrationState> {
  const sql = postgres(url, { max: 1 });
  try {
    const available = await collectMigrationFiles();
    const tableCountResult = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableCount = tableCountResult[0]?.count ?? 0;

    const tableSchema = await findMigrationTableSchema(sql);
    if (!tableSchema) {
      return {
        status: "needsMigrations",
        tableCount,
        availableMigrations: available,
        appliedMigrations: [],
        pendingMigrations: available,
        reason: tableCount > 0 ? "no-migration-journal-non-empty-db" : "no-migration-journal-empty-db",
      };
    }

    const applied = await loadApplied(sql, tableSchema, available);
    const pending = available.filter((f) => !applied.includes(f));
    if (pending.length === 0) {
      return { status: "upToDate", tableCount, availableMigrations: available, appliedMigrations: applied };
    }
    return {
      status: "needsMigrations",
      tableCount,
      availableMigrations: available,
      appliedMigrations: applied,
      pendingMigrations: pending,
      reason: "pending-migrations",
    };
  } finally {
    await sql.end();
  }
}

// ── Apply migrations ─────────────────────────────────────────────────────

export async function applyPendingMigrations(url: string): Promise<void> {
  const initial = await inspectMigrations(url);
  if (initial.status === "upToDate") return;

  const sql = postgres(url, { max: 1 });
  try {
    const db = drizzlePg(sql);
    await drizzleMigrate(db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await sql.end();
  }

  let state = await inspectMigrations(url);
  if (state.status === "upToDate") return;

  const repair = await reconcilePendingMigrationHistory(url);
  if (repair.repairedMigrations.length > 0) {
    state = await inspectMigrations(url);
    if (state.status === "upToDate") return;
  }

  if (state.status !== "needsMigrations" || state.reason !== "pending-migrations") {
    throw new Error("Migrations still pending after attempted apply");
  }

  await runMigrationsManually(url, state.pendingMigrations);

  const final = await inspectMigrations(url);
  if (final.status !== "upToDate") {
    throw new Error(`Failed to apply: ${final.pendingMigrations.join(", ")}`);
  }
}

// ── Reconciliation ───────────────────────────────────────────────────────

export async function reconcilePendingMigrationHistory(url: string): Promise<ReconcileResult> {
  const state = await inspectMigrations(url);
  if (state.status !== "needsMigrations" || state.reason !== "pending-migrations") {
    return { repairedMigrations: [], remainingMigrations: [] };
  }

  const sql = postgres(url, { max: 1 });
  const repaired: string[] = [];

  try {
    const entries = await parseJournalEntries();
    const millisByFile = new Map(entries.map((e) => [e.fileName, e.folderMillis]));
    const tableSchema = await findMigrationTableSchema(sql);
    if (!tableSchema) return { repairedMigrations: [], remainingMigrations: state.pendingMigrations };

    const colNames = await getColumnNames(sql, tableSchema);
    const qualified = `${quoteId(tableSchema)}.${quoteId(DRIZZLE_TABLE)}`;

    for (const file of state.pendingMigrations) {
      const content = await readFileContent(file);
      if (!(await migrationApplied(sql, content))) break;

      const hash = createHash("sha256").update(content).digest("hex");
      const folderMillis = millisByFile.get(file) ?? Date.now();
      const byHash = colNames.has("hash")
        ? await sql.unsafe<{ created_at: string | number | null }[]>(
            `SELECT created_at FROM ${qualified} WHERE hash = ${quoteVal(hash)} ORDER BY created_at DESC LIMIT 1`,
          )
        : [];
      const byName = colNames.has("name")
        ? await sql.unsafe<{ created_at: string | number | null }[]>(
            `SELECT created_at FROM ${qualified} WHERE name = ${quoteVal(file)} ORDER BY created_at DESC LIMIT 1`,
          )
        : [];

      if (byHash.length > 0 || byName.length > 0) {
        if (colNames.has("created_at")) {
          const hashCreatedAt = Number(byHash[0]?.created_at ?? -1);
          if (byHash.length > 0 && Number.isFinite(hashCreatedAt) && hashCreatedAt < folderMillis) {
            await sql.unsafe(
              `UPDATE ${qualified} SET created_at = ${quoteVal(String(folderMillis))} WHERE hash = ${quoteVal(hash)} AND created_at < ${quoteVal(String(folderMillis))}`,
            );
          }
          const nameCreatedAt = Number(byName[0]?.created_at ?? -1);
          if (byName.length > 0 && Number.isFinite(nameCreatedAt) && nameCreatedAt < folderMillis) {
            await sql.unsafe(
              `UPDATE ${qualified} SET created_at = ${quoteVal(String(folderMillis))} WHERE name = ${quoteVal(file)} AND created_at < ${quoteVal(String(folderMillis))}`,
            );
          }
        }
        repaired.push(file);
        continue;
      }

      const cols: string[] = [];
      const vals: string[] = [];
      if (colNames.has("hash")) { cols.push(quoteId("hash")); vals.push(quoteVal(hash)); }
      if (colNames.has("name")) { cols.push(quoteId("name")); vals.push(quoteVal(file)); }
      if (colNames.has("created_at")) { cols.push(quoteId("created_at")); vals.push(quoteVal(String(folderMillis))); }
      if (cols.length === 0) break;

      await sql.unsafe(`INSERT INTO ${qualified} (${cols.join(", ")}) VALUES (${vals.join(", ")})`);
      repaired.push(file);
    }
  } finally {
    await sql.end();
  }

  const refreshed = await inspectMigrations(url);
  return {
    repairedMigrations: repaired,
    remainingMigrations: refreshed.status === "needsMigrations" ? refreshed.pendingMigrations : [],
  };
}

// ── Bootstrap ────────────────────────────────────────────────────────────

export type BootstrapResult =
  | { migrated: true; reason: "migrated-empty-db"; tableCount: 0 }
  | { migrated: false; reason: "already-migrated"; tableCount: number }
  | { migrated: false; reason: "not-empty-no-migration-journal"; tableCount: number };

export async function migratePostgresIfEmpty(url: string): Promise<BootstrapResult> {
  const sql = postgres(url, { max: 1 });
  try {
    const tableSchema = await findMigrationTableSchema(sql);
    const tableCountResult = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableCount = tableCountResult[0]?.count ?? 0;

    if (tableSchema) return { migrated: false, reason: "already-migrated", tableCount };
    if (tableCount > 0) return { migrated: false, reason: "not-empty-no-migration-journal", tableCount };

    const db = drizzlePg(sql);
    await drizzleMigrate(db, { migrationsFolder: MIGRATIONS_DIR });
    return { migrated: true, reason: "migrated-empty-db", tableCount: 0 };
  } finally {
    await sql.end();
  }
}

// ── Database creation ────────────────────────────────────────────────────

export async function ensurePostgresDatabase(
  url: string,
  databaseName: string,
): Promise<"created" | "exists"> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName)) {
    throw new Error(`Unsafe database name: ${databaseName}`);
  }
  const sql = postgres(url, { max: 1 });
  try {
    const existing = await sql<{ one: number }[]>`
      SELECT 1 AS one FROM pg_database WHERE datname = ${databaseName} LIMIT 1
    `;
    if (existing.length > 0) return "exists";
    await sql.unsafe(`create database "${databaseName}"`);
    return "created";
  } finally {
    await sql.end();
  }
}

export type Db = ReturnType<typeof createDb>;

import { createReadStream, promises as fs, statSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageProvider, GetObjectResult, HeadObjectResult } from "./types.js";
import { notFound, badRequest } from "../../errors.js";

/**
 * Validates and normalizes an object key.
 * Rejects empty keys, absolute paths, and traversal attempts.
 */
function sanitizeKey(key: string): string {
  const clean = key.replace(/\\/g, "/").replace(/\s+/g, " ").trim();
  if (!clean || clean.startsWith("/") || clean === ".") {
    throw badRequest("Storage key must be a non-empty relative path");
  }
  const segments = clean.split("/").filter(Boolean);
  if (segments.some((s) => s === ".." || s === ".")) {
    throw badRequest("Storage key must not contain traversal segments");
  }
  return segments.join("/");
}

/**
 * Resolves a storage key to an absolute path, ensuring it stays within baseDir.
 */
function resolvePath(baseDir: string, key: string): string {
  const sanitized = sanitizeKey(key);
  const target = path.resolve(baseDir, sanitized);
  const root = path.resolve(baseDir);
  // Ensure the resolved path is under root (not equal to root, not outside)
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw badRequest("Storage key resolved outside base directory");
  }
  return target;
}

async function safeStat(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

export function createLocalDiskStorageProvider(baseDir: string): StorageProvider {
  const root = path.resolve(baseDir);

  return {
    id: "local_disk",

    async putObject(input) {
      const filePath = resolvePath(root, input.objectKey);
      const parentDir = path.dirname(filePath);
      await fs.mkdir(parentDir, { recursive: true });

      const tmpName = `.tmp-${randomUUID()}`;
      const tmpPath = path.join(parentDir, tmpName);
      await fs.writeFile(tmpPath, input.body);
      await fs.rename(tmpPath, filePath);
    },

    async getObject(input): Promise<GetObjectResult> {
      const filePath = resolvePath(root, input.objectKey);
      const stat = await safeStat(filePath);
      if (!stat || !stat.isFile()) {
        throw notFound("Storage object not found");
      }
      return {
        stream: createReadStream(filePath),
        contentLength: stat.size,
        lastModified: stat.mtime,
      };
    },

    async headObject(input): Promise<HeadObjectResult> {
      const filePath = resolvePath(root, input.objectKey);
      const stat = await safeStat(filePath);
      if (!stat || !stat.isFile()) {
        return { exists: false };
      }
      return {
        exists: true,
        contentLength: stat.size,
        lastModified: stat.mtime,
      };
    },

    async deleteObject(input): Promise<void> {
      const filePath = resolvePath(root, input.objectKey);
      try {
        await fs.unlink(filePath);
      } catch {
        // delete is idempotent
      }
    },
  };
}

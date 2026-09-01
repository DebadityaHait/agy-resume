import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Session } from "../types.js";
import { getAntigravityPaths } from "../adapters/antigravity/paths.js";
import { logger } from "../utils/logger.js";

export interface SerializedSession {
  id: string;
  workspace: string;
  title?: string | undefined;
  firstPrompt?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  messageCount?: number | undefined;
  source: "antigravity";
}

export interface CachePayload {
  version: 1;
  dataDir: string;
  historyMtimeMs: number;
  historySizeBytes: number;
  cachedAt: string;
  sessions: SerializedSession[];
}

/**
 * Returns the OS-appropriate cache directory path for agy-resume.
 */
export function getCacheDirectory(overrideCacheDir?: string): string {
  if (overrideCacheDir && overrideCacheDir.trim()) {
    return path.resolve(overrideCacheDir.trim());
  }

  const envCache = process.env.AGY_RESUME_CACHE_DIR;
  if (envCache && envCache.trim()) {
    return path.resolve(envCache.trim());
  }

  const home = os.homedir();
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return path.join(localAppData, "agy-resume", "cache");
  } else if (process.platform === "darwin") {
    return path.join(home, "Library", "Caches", "agy-resume");
  } else {
    const xdgCache = process.env.XDG_CACHE_HOME || path.join(home, ".cache");
    return path.join(xdgCache, "agy-resume");
  }
}

/**
 * Returns the path to the cache file.
 */
export function getCacheFilePath(dataDir: string, overrideCacheDir?: string): string {
  const cacheDir = getCacheDirectory(overrideCacheDir);
  // Hash or sanitize dataDir into filename
  const sanitized = dataDir.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-40);
  return path.join(cacheDir, `sessions_${sanitized}.json`);
}

/**
 * Reads cached sessions if valid.
 */
export function readCachedSessions(
  dataDir: string,
  overrideCacheDir?: string
): Session[] | null {
  const cacheFile = getCacheFilePath(dataDir, overrideCacheDir);

  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(cacheFile, "utf-8");
    const payload = JSON.parse(content) as CachePayload;

    if (payload.version !== 1 || payload.dataDir !== dataDir) {
      return null;
    }

    // Check history file mtime & size
    const paths = getAntigravityPaths(dataDir);
    if (fs.existsSync(paths.historyFile)) {
      const stat = fs.statSync(paths.historyFile);
      if (
        stat.mtimeMs !== payload.historyMtimeMs ||
        stat.size !== payload.historySizeBytes
      ) {
        logger.debug("Cache invalidated due to history.jsonl changes");
        return null;
      }
    }

    // Deserialize sessions
    return payload.sessions.map((s) => ({
      id: s.id,
      workspace: s.workspace,
      title: s.title,
      firstPrompt: s.firstPrompt,
      createdAt: s.createdAt ? new Date(s.createdAt) : undefined,
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
      messageCount: s.messageCount,
      source: "antigravity" as const,
    }));
  } catch (err) {
    logger.debug("Failed reading cache, will recompute:", err);
    try {
      fs.unlinkSync(cacheFile);
    } catch {
      // Ignore
    }
    return null;
  }
}

/**
 * Writes sessions to the local cache.
 */
export function writeCachedSessions(
  dataDir: string,
  sessions: Session[],
  overrideCacheDir?: string
): void {
  try {
    const cacheDir = getCacheDirectory(overrideCacheDir);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const paths = getAntigravityPaths(dataDir);
    let historyMtimeMs = 0;
    let historySizeBytes = 0;

    if (fs.existsSync(paths.historyFile)) {
      const stat = fs.statSync(paths.historyFile);
      historyMtimeMs = stat.mtimeMs;
      historySizeBytes = stat.size;
    }

    const serialized: SerializedSession[] = sessions.map((s) => ({
      id: s.id,
      workspace: s.workspace,
      title: s.title,
      firstPrompt: s.firstPrompt,
      createdAt: s.createdAt?.toISOString(),
      updatedAt: s.updatedAt?.toISOString(),
      messageCount: s.messageCount,
      source: "antigravity",
    }));

    const payload: CachePayload = {
      version: 1,
      dataDir,
      historyMtimeMs,
      historySizeBytes,
      cachedAt: new Date().toISOString(),
      sessions: serialized,
    };

    const cacheFile = getCacheFilePath(dataDir, overrideCacheDir);
    fs.writeFileSync(cacheFile, JSON.stringify(payload), "utf-8");
    logger.debug(`Cached ${sessions.length} sessions to ${cacheFile}`);
  } catch (err) {
    logger.debug("Failed writing to cache:", err);
  }
}

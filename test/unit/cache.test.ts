import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Session } from "../../src/types.js";
import {
  readCachedSessions,
  writeCachedSessions,
  getCacheFilePath,
} from "../../src/discovery/cache.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");

describe("cache", () => {
  let tempCacheDir: string;
  const fixtureDataDir = path.join(FIXTURES_DIR, "standard");

  beforeEach(() => {
    tempCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "agyr-test-cache-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("writes and reads cached sessions successfully", () => {
    const sessions: Session[] = [
      {
        id: "test-sess-1",
        workspace: "C:\\Projects\\test",
        title: "Test Session",
        firstPrompt: "First prompt text",
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
        updatedAt: new Date("2026-09-01T12:00:00.000Z"),
        messageCount: 5,
        source: "antigravity",
      },
    ];

    writeCachedSessions(fixtureDataDir, sessions, tempCacheDir);

    const cached = readCachedSessions(fixtureDataDir, tempCacheDir);
    expect(cached).not.toBeNull();
    expect(cached?.length).toBe(1);
    expect(cached?.[0]?.id).toBe("test-sess-1");
    expect(cached?.[0]?.title).toBe("Test Session");
    expect(cached?.[0]?.updatedAt).toEqual(new Date("2026-09-01T12:00:00.000Z"));
  });

  it("recovers gracefully from corrupted cache file", () => {
    const cacheFile = getCacheFilePath(fixtureDataDir, tempCacheDir);
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, "CORRUPT JSON CONTENT {{{", "utf-8");

    const cached = readCachedSessions(fixtureDataDir, tempCacheDir);
    expect(cached).toBeNull();
  });
});

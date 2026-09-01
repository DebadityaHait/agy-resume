import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { discoverSessions } from "../../src/discovery/discover.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");

function computeFileHash(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

describe("discovery integration", () => {
  const standardFixture = path.join(FIXTURES_DIR, "standard");

  it("filters sessions to exact workspace on Windows style paths", async () => {
    const result = await discoverSessions({
      dataDir: standardFixture,
      cwd: "c:\\projects\\ticktick",
      scope: "exact",
      noCache: true,
    });

    expect(result.sessions.length).toBe(2);
    const ids = result.sessions.map((s) => s.id);
    expect(ids).toContain("conv-ticktick-1");
    expect(ids).toContain("conv-ticktick-2");
    expect(ids).not.toContain("conv-ticktick-sub");
    expect(ids).not.toContain("conv-domains-1");
  });

  it("filters sessions with tree scope including subdirectories", async () => {
    const result = await discoverSessions({
      dataDir: standardFixture,
      cwd: "C:\\Projects\\ticktick",
      scope: "tree",
      noCache: true,
    });

    expect(result.sessions.length).toBe(3);
    const ids = result.sessions.map((s) => s.id);
    expect(ids).toContain("conv-ticktick-1");
    expect(ids).toContain("conv-ticktick-2");
    expect(ids).toContain("conv-ticktick-sub");
  });

  it("returns all sessions when --all is used", async () => {
    const result = await discoverSessions({
      dataDir: standardFixture,
      cwd: "C:\\Projects\\ticktick",
      scope: "all",
      noCache: true,
    });

    expect(result.sessions.length).toBeGreaterThanOrEqual(5);
  });

  it("filters sessions on POSIX style paths", async () => {
    const result = await discoverSessions({
      dataDir: standardFixture,
      cwd: "/home/user/app",
      scope: "exact",
      noCache: true,
    });

    const ids = result.sessions.map((s) => s.id);
    expect(ids).toContain("conv-linux-1");
    expect(ids).not.toContain("conv-linux-sub");
    expect(ids).not.toContain("conv-linux-other");
  });

  it("enforces read-only safety on Antigravity fixture files", async () => {
    const historyFile = path.join(standardFixture, "history.jsonl");
    const metaFile = path.join(standardFixture, "cache", "conversation_metadata.json");

    const historyHashBefore = computeFileHash(historyFile);
    const metaHashBefore = computeFileHash(metaFile);

    // Run multiple discovery and filtering operations
    await discoverSessions({ dataDir: standardFixture, cwd: "C:\\Projects\\ticktick", scope: "exact" });
    await discoverSessions({ dataDir: standardFixture, cwd: "C:\\Projects\\domains", scope: "all" });

    const historyHashAfter = computeFileHash(historyFile);
    const metaHashAfter = computeFileHash(metaFile);

    expect(historyHashAfter).toBe(historyHashBefore);
    expect(metaHashAfter).toBe(metaHashBefore);
  });
});

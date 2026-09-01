import path from "node:path";
import { describe, it, expect } from "vitest";
import { parseHistoryFile } from "../../src/adapters/antigravity/history.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");

describe("parseHistoryFile", () => {
  it("parses valid history.jsonl and aggregates conversations", async () => {
    const historyPath = path.join(FIXTURES_DIR, "standard", "history.jsonl");
    const result = await parseHistoryFile(historyPath);

    expect(result.totalLines).toBe(8);
    expect(result.validRecords).toBe(8);
    expect(result.malformedLines).toBe(0);

    // Verify discovered conversation IDs
    expect(result.sessions.has("conv-ticktick-1")).toBe(true);
    expect(result.sessions.has("conv-ticktick-2")).toBe(true);
    expect(result.sessions.has("conv-domains-1")).toBe(true);

    const conv1 = result.sessions.get("conv-ticktick-1")!;
    expect(conv1.firstDisplay).toBe("Check Local Patcher Requirements");
    expect(conv1.workspace).toBe("C:\\Projects\\ticktick");
  });

  it("handles corrupted lines and truncated end gracefully without crashing", async () => {
    const corruptedPath = path.join(FIXTURES_DIR, "corrupted", "history.jsonl");
    const result = await parseHistoryFile(corruptedPath);

    expect(result.validRecords).toBe(3);
    expect(result.malformedLines).toBe(2); // The invalid line and the truncated line
    expect(result.sessions.size).toBe(3);
    expect(result.sessions.has("conv-valid-1")).toBe(true);
    expect(result.sessions.has("conv-valid-2")).toBe(true);
    expect(result.sessions.has("conv-valid-3")).toBe(true);
  });

  it("returns empty result if file does not exist", async () => {
    const result = await parseHistoryFile(path.join(FIXTURES_DIR, "nonexistent.jsonl"));
    expect(result.sessions.size).toBe(0);
    expect(result.totalLines).toBe(0);
  });
});

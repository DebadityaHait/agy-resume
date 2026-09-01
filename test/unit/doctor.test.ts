import path from "node:path";
import { describe, it, expect } from "vitest";
import { runDoctor } from "../../src/commands/doctor.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");

describe("doctor", () => {
  it("runs diagnostics on standard fixture and returns valid checks", async () => {
    const fixtureDataDir = path.join(FIXTURES_DIR, "standard");
    const result = await runDoctor({
      dataDir: fixtureDataDir,
      cwd: "C:\\Projects\\ticktick",
      noCache: true,
    });

    expect(result.checks.length).toBeGreaterThanOrEqual(7);

    const nodeCheck = result.checks.find((c) => c.name === "Node.js");
    expect(nodeCheck?.status).toBe("OK");

    const dataCheck = result.checks.find((c) => c.name === "Antigravity data");
    expect(dataCheck?.status).toBe("OK");

    const historyCheck = result.checks.find((c) => c.name === "history.jsonl");
    expect(historyCheck?.status).toBe("OK");

    const matchCheck = result.checks.find((c) => c.name === "Workspace matches");
    expect(matchCheck?.status).toBe("OK");
  });
});

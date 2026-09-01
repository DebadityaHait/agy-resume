import path from "node:path";
import crossSpawn from "cross-spawn";
import { describe, it, expect } from "vitest";

const CLI_PATH = path.resolve(import.meta.dirname, "../../dist/cli.js");
const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");
const STANDARD_DATA_DIR = path.join(FIXTURES_DIR, "standard");

function runCli(args: string[], env: Record<string, string> = {}) {
  return crossSpawn.sync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf-8",
    env: { ...process.env, ...env },
  });
}

describe("CLI commands", () => {
  it("outputs --help correctly", () => {
    const res = runCli(["--help"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Cross-platform workspace-scoped conversation picker");
    expect(res.stdout).toContain("--all");
    expect(res.stdout).toContain("--scope");
    expect(res.stdout).toContain("--json");
    expect(res.stdout).toContain("--doctor");
  });

  it("outputs --version correctly", () => {
    const res = runCli(["--version"]);
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0.1.0");
  });

  it("outputs valid JSON array with --json", () => {
    const res = runCli([
      "--json",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);

    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout) as Array<{ id: string; workspace: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed.map((s) => s.id)).toContain("conv-ticktick-1");
    expect(parsed.map((s) => s.id)).toContain("conv-ticktick-2");
  });

  it("outputs valid JSON across all workspaces with --all --json", () => {
    const res = runCli([
      "--all",
      "--json",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);

    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout) as Array<{ id: string; workspace: string }>;
    expect(parsed.length).toBeGreaterThanOrEqual(5);
  });

  it("prints only ID with --print-id when exactly 1 conversation matches query", () => {
    const res = runCli([
      "patcher requirements",
      "--print-id",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("conv-ticktick-1");
  });

  it("runs --doctor successfully", () => {
    const res = runCli([
      "--doctor",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("agy-resume doctor");
    expect(res.stdout).toContain("Node.js");
    expect(res.stdout).toContain("Antigravity data");
  });

  it("handles invalid arguments with non-zero exit code", () => {
    const res = runCli(["--scope", "invalid-scope-mode"]);
    expect(res.status).not.toBe(0);
  });
});

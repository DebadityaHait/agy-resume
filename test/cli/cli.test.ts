import fs from "node:fs";
import os from "node:os";
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
    expect(res.stdout).toContain(
      "Cross-platform workspace-scoped conversation picker"
    );
    expect(res.stdout).toContain("[--agy <agy arguments...>]");
    expect(res.stdout).toContain("--all");
    expect(res.stdout).toContain("--scope");
    expect(res.stdout).toContain("--json");
    expect(res.stdout).toContain("--doctor");
  });

  it("outputs --version correctly", () => {
    const res = runCli(["--version"]);
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0.2.0");
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
    const parsed = JSON.parse(res.stdout) as Array<{
      id: string;
      workspace: string;
    }>;
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
    const parsed = JSON.parse(res.stdout) as Array<{
      id: string;
      workspace: string;
    }>;
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

  it("rejects conversation override through --agy (--conversation and = forms)", () => {
    const res1 = runCli(["auth", "--agy", "--conversation", "other-id"]);
    expect(res1.status).not.toBe(0);
    expect(res1.stderr).toContain(
      "Cannot pass --conversation through --agy because agyr manages conversation selection."
    );

    const res2 = runCli(["auth", "--agy", "--conversation=other-id"]);
    expect(res2.status).not.toBe(0);
    expect(res2.stderr).toContain(
      "Cannot pass --conversation through --agy because agyr manages conversation selection."
    );
  });

  it("does not reject speculative -conversation through --agy", () => {
    const res = runCli([
      "patcher requirements",
      "--no-launch",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
      "--agy",
      "-conversation",
      "other-id",
    ]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Extra flags: -conversation other-id");
  });

  it("does not block -c through --agy because -c is --continue in agy", () => {
    const res = runCli([
      "patcher requirements",
      "--no-launch",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
      "--agy",
      "-c",
      "other-id",
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Selected conversation:");
    expect(res.stdout).toContain("conv-ticktick-1");
    expect(res.stdout).toContain("Extra flags: -c other-id");
  });

  it("displays extra flags when --no-launch is active with passthrough args", () => {
    const res = runCli([
      "patcher requirements",
      "--no-launch",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
      "--agy",
      "--dangerously-skip-permissions",
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Selected conversation:");
    expect(res.stdout).toContain("conv-ticktick-1");
    expect(res.stdout).toContain("Extra flags: --dangerously-skip-permissions");
  });

  it("does not display extra flags when --no-launch is active without passthrough args", () => {
    const res = runCli([
      "patcher requirements",
      "--no-launch",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Selected conversation:");
    expect(res.stdout).toContain("conv-ticktick-1");
    expect(res.stdout).not.toContain("Extra flags:");
  });

  it("forwards basic passthrough arguments after --agy to the launcher", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agyr-cli-launch-"));
    const logFile = path.join(tempDir, "launch.log");
    const fakeAgyScript =
      process.platform === "win32"
        ? path.join(tempDir, "agy.cmd")
        : path.join(tempDir, "agy");

    if (process.platform === "win32") {
      fs.writeFileSync(
        fakeAgyScript,
        `@echo off\r\necho %* > "${logFile}"\r\nexit /b 0\r\n`,
        "utf-8"
      );
    } else {
      fs.writeFileSync(
        fakeAgyScript,
        `#!/bin/sh\necho "$@" > "${logFile}"\nexit 0\n`,
        "utf-8"
      );
      fs.chmodSync(fakeAgyScript, 0o755);
    }

    try {
      const res = runCli([
        "patcher requirements",
        "--data-dir",
        STANDARD_DATA_DIR,
        "--cwd",
        "C:\\Projects\\ticktick",
        "--agy-path",
        fakeAgyScript,
        "--agy",
        "--dangerously-skip-permissions",
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(logFile)).toBe(true);
      const logContent = fs.readFileSync(logFile, "utf-8");
      expect(logContent).toMatch(/--conversation/);
      expect(logContent).toMatch(/conv-ticktick-1/);
      expect(logContent).toMatch(/--dangerously-skip-permissions/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("forwards multiple passthrough arguments after --agy to the launcher", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agyr-cli-launch-"));
    const logFile = path.join(tempDir, "launch.log");
    const fakeAgyScript =
      process.platform === "win32"
        ? path.join(tempDir, "agy.cmd")
        : path.join(tempDir, "agy");

    if (process.platform === "win32") {
      fs.writeFileSync(
        fakeAgyScript,
        `@echo off\r\necho %* > "${logFile}"\r\nexit /b 0\r\n`,
        "utf-8"
      );
    } else {
      fs.writeFileSync(
        fakeAgyScript,
        `#!/bin/sh\necho "$@" > "${logFile}"\nexit 0\n`,
        "utf-8"
      );
      fs.chmodSync(fakeAgyScript, 0o755);
    }

    try {
      const res = runCli([
        "patcher requirements",
        "--data-dir",
        STANDARD_DATA_DIR,
        "--cwd",
        "C:\\Projects\\ticktick",
        "--agy-path",
        fakeAgyScript,
        "--agy",
        "--model",
        "flash",
        "--dangerously-skip-permissions",
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(logFile)).toBe(true);
      const logContent = fs.readFileSync(logFile, "utf-8");
      expect(logContent).toMatch(/--conversation/);
      expect(logContent).toMatch(/conv-ticktick-1/);
      expect(logContent).toMatch(/--model/);
      expect(logContent).toMatch(/flash/);
      expect(logContent).toMatch(/--dangerously-skip-permissions/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps shared option names unambiguous across the --agy boundary", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agyr-cli-launch-"));
    const logFile = path.join(tempDir, "launch.log");
    const fakeAgyScript =
      process.platform === "win32"
        ? path.join(tempDir, "agy.cmd")
        : path.join(tempDir, "agy");

    if (process.platform === "win32") {
      fs.writeFileSync(
        fakeAgyScript,
        `@echo off\r\necho %* > "${logFile}"\r\nexit /b 0\r\n`,
        "utf-8"
      );
    } else {
      fs.writeFileSync(
        fakeAgyScript,
        `#!/bin/sh\necho "$@" > "${logFile}"\nexit 0\n`,
        "utf-8"
      );
      fs.chmodSync(fakeAgyScript, 0o755);
    }

    try {
      const res = runCli([
        "--debug",
        "patcher requirements",
        "--data-dir",
        STANDARD_DATA_DIR,
        "--cwd",
        "C:\\Projects\\ticktick",
        "--agy-path",
        fakeAgyScript,
        "--agy",
        "--debug",
      ]);

      expect(res.status).toBe(0);
      // First --debug activates agyr debug logger (outputs to stderr/stdout)
      expect(res.stderr).toContain("[debug]");
      // Second --debug is forwarded to agy
      expect(fs.existsSync(logFile)).toBe(true);
      const logContent = fs.readFileSync(logFile, "utf-8");
      expect(logContent).toMatch(/--conversation/);
      expect(logContent).toMatch(/--debug/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when unknown option is passed without --agy boundary (no auto-forwarding)", () => {
    const res = runCli([
      "patcher requirements",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
      "--model",
      "flash",
    ]);

    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain("unknown option '--model'");
  });

  it("fails on typos through normal Commander option parsing", () => {
    const res = runCli(["--scpoe", "repo"]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain("unknown option '--scpoe'");
    expect(res.stderr).toContain("--scope");
  });

  it("handles empty passthrough (--agy without args) gracefully", () => {
    const res = runCli([
      "patcher requirements",
      "--no-launch",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
      "--agy",
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Selected conversation:");
    expect(res.stdout).toContain("conv-ticktick-1");
    expect(res.stdout).not.toContain("Extra flags:");
  });

  it("fails in non-interactive mode when multiple conversations match and no submode specified", () => {
    const res = runCli([
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain("Multiple conversations found");
  });

  it("existing search/query regression test: queries with quotes and scopes work", () => {
    const res = runCli([
      "auth token",
      "--scope",
      "exact",
      "--json",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("existing search/query regression test: agyr auth with --scope tree", () => {
    const res = runCli([
      "auth",
      "--scope",
      "tree",
      "--json",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout) as Array<{ id: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
  });

  it("existing search/query regression test: agyr with --scope repo in git directory", () => {
    const res = runCli([
      "--scope",
      "repo",
      "--json",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      process.cwd(),
    ]);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("existing search/query regression test: agyr with query and --no-launch", () => {
    const res = runCli([
      "patcher requirements",
      "--no-launch",
      "--data-dir",
      STANDARD_DATA_DIR,
      "--cwd",
      "C:\\Projects\\ticktick",
    ]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Selected conversation:");
    expect(res.stdout).toContain("conv-ticktick-1");
  });

  it("exports main function which can be imported safely without auto-executing", async () => {
    const mod = await import("../../src/cli.js");
    expect(typeof mod.main).toBe("function");
  });
});

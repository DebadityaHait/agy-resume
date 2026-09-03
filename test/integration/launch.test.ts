import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { launchAntigravity } from "../../src/launch/antigravity.js";
import { resolveAntigravityExecutable } from "../../src/launch/which.js";

describe("launch integration", () => {
  let tempDir: string;
  let fakeAgyScript: string;
  let logFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agyr-fake-agy-"));
    logFile = path.join(tempDir, "launch.log");

    if (process.platform === "win32") {
      fakeAgyScript = path.join(tempDir, "agy.cmd");
      fs.writeFileSync(
        fakeAgyScript,
        `@echo off\r\necho %* > "${logFile}"\r\necho %CD% >> "${logFile}"\r\nexit /b 0\r\n`,
        "utf-8"
      );
    } else {
      fakeAgyScript = path.join(tempDir, "agy");
      fs.writeFileSync(
        fakeAgyScript,
        `#!/bin/sh\necho "$@" > "${logFile}"\npwd >> "${logFile}"\nexit 0\n`,
        "utf-8"
      );
      fs.chmodSync(fakeAgyScript, 0o755);
    }
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("resolves explicit executable path", () => {
    const resolved = resolveAntigravityExecutable(fakeAgyScript);
    expect(resolved).not.toBeNull();
  });

  it("spawns fake agy with correct arguments and working directory", async () => {
    const targetWorkspace = path.resolve(tempDir);
    const exitCode = await launchAntigravity("test-session-123", {
      cwd: targetWorkspace,
      executablePath: fakeAgyScript,
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(logFile)).toBe(true);

    const logContent = fs.readFileSync(logFile, "utf-8");
    expect(logContent).toMatch(/--conversation/);
    expect(logContent).toMatch(/test-session-123/);
  });

  it("spawns fake agy with forwarded passthrough arguments", async () => {
    const targetWorkspace = path.resolve(tempDir);
    const exitCode = await launchAntigravity("test-session-123", {
      cwd: targetWorkspace,
      executablePath: fakeAgyScript,
      args: ["--dangerously-skip-permissions", "--verbose"],
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(logFile)).toBe(true);

    const logContent = fs.readFileSync(logFile, "utf-8");
    expect(logContent).toMatch(/--conversation/);
    expect(logContent).toMatch(/test-session-123/);
    expect(logContent).toMatch(/--dangerously-skip-permissions/);
    expect(logContent).toMatch(/--verbose/);
  });

  it("rejects --conversation in passthrough args", async () => {
    const targetWorkspace = path.resolve(tempDir);
    await expect(
      launchAntigravity("test-session-123", {
        cwd: targetWorkspace,
        executablePath: fakeAgyScript,
        args: ["--conversation", "other-session"],
      })
    ).rejects.toThrow(/--conversation/);

    await expect(
      launchAntigravity("test-session-123", {
        cwd: targetWorkspace,
        executablePath: fakeAgyScript,
        args: ["--conversation=other-session"],
      })
    ).rejects.toThrow(/--conversation/);
  });

  it("does not block -c because it is --continue in agy", async () => {
    const targetWorkspace = path.resolve(tempDir);
    const exitCode = await launchAntigravity("test-session-123", {
      cwd: targetWorkspace,
      executablePath: fakeAgyScript,
      args: ["-c"],
    });

    expect(exitCode).toBe(0);
    const logContent = fs.readFileSync(logFile, "utf-8");
    expect(logContent).toMatch(/-c/);
  });
});

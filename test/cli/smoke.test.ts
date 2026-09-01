import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crossSpawn from "cross-spawn";
import { describe, it, expect } from "vitest";

const ROOT_DIR = path.resolve(import.meta.dirname, "../..");
const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");
const STANDARD_DATA_DIR = path.join(FIXTURES_DIR, "standard");

describe("package smoke test (npm pack & install)", () => {
  it("installs packed tarball and executes binaries successfully", () => {
    // Step 1: Run npm pack
    const packResult = crossSpawn.sync("npm", ["pack"], {
      cwd: ROOT_DIR,
      encoding: "utf-8",
      shell: true,
    });
    expect(packResult.status).toBe(0);

    const tarballName = packResult.stdout.trim().split("\n").pop()?.trim();
    expect(tarballName).toMatch(/agy-resume-.*\.tgz$/);

    const tarballPath = path.join(ROOT_DIR, tarballName!);
    expect(fs.existsSync(tarballPath)).toBe(true);

    // Step 2: Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agyr-smoke-"));

    try {
      // Step 3: Initialize temp package and install tarball
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "smoke-test-project", version: "1.0.0" }),
        "utf-8"
      );

      const installResult = crossSpawn.sync("npm", ["install", tarballPath], {
        cwd: tempDir,
        encoding: "utf-8",
        shell: true,
      });
      expect(installResult.status).toBe(0);

      // Step 4: Run npx agyr --help
      const helpResult = crossSpawn.sync("npx", ["agyr", "--help"], {
        cwd: tempDir,
        encoding: "utf-8",
        shell: true,
      });
      expect(helpResult.status).toBe(0);
      expect(helpResult.stdout).toContain("Cross-platform workspace-scoped conversation picker");

      // Step 5: Run npx agy-resume --help
      const helpResumeResult = crossSpawn.sync("npx", ["agy-resume", "--help"], {
        cwd: tempDir,
        encoding: "utf-8",
        shell: true,
      });
      expect(helpResumeResult.status).toBe(0);
      expect(helpResumeResult.stdout).toContain("Cross-platform workspace-scoped conversation picker");

      // Step 6: Run npx agyr --version
      const versionResult = crossSpawn.sync("npx", ["agyr", "--version"], {
        cwd: tempDir,
        encoding: "utf-8",
        shell: true,
      });
      expect(versionResult.status).toBe(0);
      expect(versionResult.stdout.trim()).toBe("0.1.0");

      // Step 7: Run npx agyr --json with fixture data
      const jsonResult = crossSpawn.sync(
        "npx",
        ["agyr", "--json", "--data-dir", STANDARD_DATA_DIR, "--cwd", "C:\\Projects\\ticktick"],
        {
          cwd: tempDir,
          encoding: "utf-8",
          shell: true,
        }
      );
      expect(jsonResult.status).toBe(0);
      const parsed = JSON.parse(jsonResult.stdout) as Array<{ id: string }>;
      expect(parsed.length).toBe(2);
    } finally {
      // Cleanup tarball and temp directory
      try {
        if (fs.existsSync(tarballPath)) {
          fs.unlinkSync(tarballPath);
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error
      }
    }
  });
});

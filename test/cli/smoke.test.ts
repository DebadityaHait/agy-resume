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

      // Binary paths
      const isWindows = process.platform === "win32";
      const binDir = path.join(tempDir, "node_modules", ".bin");
      const agyrBin = path.join(binDir, isWindows ? "agyr.cmd" : "agyr");
      const agyResumeBin = path.join(binDir, isWindows ? "agy-resume.cmd" : "agy-resume");

      // Ensure execute permissions on POSIX
      if (!isWindows) {
        try {
          fs.chmodSync(agyrBin, 0o755);
          fs.chmodSync(agyResumeBin, 0o755);
        } catch {
          // Ignore
        }
      }

      // Step 4: Run agyr --help
      const helpResult = crossSpawn.sync(agyrBin, ["--help"], {
        cwd: tempDir,
        encoding: "utf-8",
        shell: isWindows,
      });
      expect(helpResult.status).toBe(0);
      expect(helpResult.stdout).toContain("Cross-platform workspace-scoped conversation picker");

      // Step 5: Run agy-resume --help
      const helpResumeResult = crossSpawn.sync(agyResumeBin, ["--help"], {
        cwd: tempDir,
        encoding: "utf-8",
        shell: isWindows,
      });
      expect(helpResumeResult.status).toBe(0);
      expect(helpResumeResult.stdout).toContain("Cross-platform workspace-scoped conversation picker");

      // Step 6: Run agyr --version
      const versionResult = crossSpawn.sync(agyrBin, ["--version"], {
        cwd: tempDir,
        encoding: "utf-8",
        shell: isWindows,
      });
      expect(versionResult.status).toBe(0);
      expect(versionResult.stdout.trim()).toBe("0.1.0");

      // Step 7: Run agyr --json with fixture data
      const jsonResult = crossSpawn.sync(
        agyrBin,
        ["--json", "--data-dir", STANDARD_DATA_DIR, "--cwd", "C:\\Projects\\ticktick"],
        {
          cwd: tempDir,
          encoding: "utf-8",
          shell: isWindows,
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

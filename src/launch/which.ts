import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Resolves the path to the Antigravity (agy) CLI executable.
 * Precedence:
 * 1. CLI explicit flag (--agy-path)
 * 2. Environment variable AGY_RESUME_AGY_PATH
 * 3. System PATH lookup
 * 4. Standard default installation locations
 */
export function resolveAntigravityExecutable(customPath?: string): string | null {
  if (customPath && customPath.trim()) {
    const resolved = path.resolve(customPath.trim());
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    return null;
  }

  const envPath = process.env.AGY_RESUME_AGY_PATH;
  if (envPath && envPath.trim()) {
    const resolved = path.resolve(envPath.trim());
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    return null;
  }

  const pathEnv = process.env.PATH || process.env.Path || "";
  const pathDirs = pathEnv.split(path.delimiter).filter(Boolean);

  const isWindows = process.platform === "win32";
  const extensions = isWindows ? [".cmd", ".exe", ".bat", ".ps1", ""] : [""];

  for (const dir of pathDirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir, `agy${ext}`);
      try {
        if (fs.existsSync(candidate)) {
          const stat = fs.statSync(candidate);
          if (stat.isFile()) {
            return candidate;
          }
        }
      } catch {
        // Ignore permission or file access errors
      }
    }
  }

  // Check common installation locations
  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const agyLocal = path.join(localAppData, "agy", "bin", "agy.exe");
      if (fs.existsSync(agyLocal)) return agyLocal;
    }
    const appData = process.env.APPDATA;
    if (appData) {
      const npmCandidate = path.join(appData, "npm", "agy.cmd");
      if (fs.existsSync(npmCandidate)) return npmCandidate;
    }
  } else {
    // POSIX fallback check
    const localBin = path.join(os.homedir(), ".local", "bin", "agy");
    if (fs.existsSync(localBin)) return localBin;
    const agyHomeBin = path.join(os.homedir(), ".agy", "bin", "agy");
    if (fs.existsSync(agyHomeBin)) return agyHomeBin;
  }

  return null;
}

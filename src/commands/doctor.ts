import fs from "node:fs";
import path from "node:path";
import crossSpawn from "cross-spawn";
import pc from "picocolors";
import type { DiscoveryOptions, DoctorCheck, DoctorResult } from "../types.js";
import { resolveAntigravityDataDir, getAntigravityPaths } from "../adapters/antigravity/paths.js";
import { parseHistoryFile } from "../adapters/antigravity/history.js";
import { parseMetadataFiles } from "../adapters/antigravity/metadata.js";
import { resolveAntigravityExecutable } from "../launch/which.js";
import { discoverSessions } from "../discovery/discover.js";
import { getCacheFilePath } from "../discovery/cache.js";
import { findGitRepoRoot } from "../paths/scope.js";

/**
 * Runs diagnostic checks on the environment, Antigravity installation, and session data.
 */
export async function runDoctor(options: DiscoveryOptions = {}): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  const targetCwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const dataDir = resolveAntigravityDataDir(options.dataDir);
  const paths = getAntigravityPaths(dataDir);

  // 1. Node.js Version
  const nodeVersion = process.version;
  const majorNode = parseInt(nodeVersion.slice(1).split(".")[0] || "0", 10);
  if (majorNode >= 22) {
    checks.push({
      name: "Node.js",
      status: "OK",
      details: nodeVersion.slice(1),
    });
  } else {
    checks.push({
      name: "Node.js",
      status: "WARN",
      details: `${nodeVersion} (Node 22+ recommended)`,
      remediation: "Upgrade to Node.js 22 LTS or newer.",
    });
  }

  // 2. Platform
  checks.push({
    name: "Platform",
    status: "OK",
    details: `${process.platform} ${process.arch}`,
  });

  // 3. Current Directory
  const gitRoot = findGitRepoRoot(targetCwd);
  checks.push({
    name: "Current directory",
    status: "OK",
    details: `${targetCwd}${gitRoot ? ` (git: ${path.basename(gitRoot)})` : ""}`,
  });

  // 4. Antigravity CLI Executable
  const agyExec = resolveAntigravityExecutable(options.agyPath);
  if (agyExec) {
    let versionStr = "found";
    try {
      const proc = crossSpawn.sync(agyExec, ["--version"], { encoding: "utf-8", timeout: 3000 });
      if (proc.status === 0 && proc.stdout) {
        versionStr = proc.stdout.trim().split("\n")[0] || "found";
      }
    } catch {
      // Fallback
    }
    checks.push({
      name: "Antigravity CLI",
      status: "OK",
      details: `${agyExec} (${versionStr})`,
    });
  } else {
    checks.push({
      name: "Antigravity CLI",
      status: "NOT FOUND",
      details: "Could not locate `agy` on PATH",
      remediation: "Install Antigravity CLI or specify path with `agyr --agy-path <path>`.",
    });
  }

  // 5. Antigravity Data Directory
  if (fs.existsSync(dataDir)) {
    checks.push({
      name: "Antigravity data",
      status: "OK",
      details: dataDir,
    });
  } else {
    checks.push({
      name: "Antigravity data",
      status: "NOT FOUND",
      details: `Directory not found at ${dataDir}`,
      remediation: "Verify Antigravity CLI has been run, or pass `--data-dir <path>`.",
    });
  }

  // 6. history.jsonl
  if (fs.existsSync(paths.historyFile)) {
    try {
      const histResult = await parseHistoryFile(paths.historyFile);
      if (histResult.malformedLines === 0) {
        checks.push({
          name: "history.jsonl",
          status: "OK",
          details: `${histResult.validRecords} records across ${histResult.sessions.size} sessions`,
        });
      } else {
        checks.push({
          name: "history.jsonl",
          status: "WARN",
          details: `${histResult.validRecords} valid records (${histResult.malformedLines} malformed lines skipped)`,
        });
      }
    } catch (err) {
      checks.push({
        name: "history.jsonl",
        status: "FAIL",
        details: `Error reading file: ${String(err)}`,
      });
    }
  } else {
    checks.push({
      name: "history.jsonl",
      status: "NOT FOUND",
      details: `File not found at ${paths.historyFile}`,
    });
  }

  // 7. Session Metadata Cache
  if (fs.existsSync(paths.metadataFile)) {
    try {
      const meta = await parseMetadataFiles(paths.metadataFile, paths.lastConversationsFile);
      checks.push({
        name: "Session metadata",
        status: "OK",
        details: `${meta.conversations.size} cached conversations`,
      });
    } catch {
      checks.push({
        name: "Session metadata",
        status: "WARN",
        details: "Unable to parse conversation_metadata.json",
      });
    }
  }

  // 8. Workspace Matches
  try {
    const discovery = await discoverSessions({
      ...options,
      cwd: targetCwd,
      scope: options.scope ?? "exact",
    });

    checks.push({
      name: "Workspace matches",
      status: "OK",
      details: `${discovery.sessions.length} conversation(s) matching scope: ${options.scope ?? "exact"}`,
    });
  } catch (err) {
    checks.push({
      name: "Workspace matches",
      status: "FAIL",
      details: `Discovery failed: ${String(err)}`,
    });
  }

  // 9. agy-resume local cache
  const cacheFile = getCacheFilePath(dataDir, options.cacheDir);
  if (fs.existsSync(cacheFile)) {
    checks.push({
      name: "Local cache",
      status: "OK",
      details: cacheFile,
    });
  } else {
    checks.push({
      name: "Local cache",
      status: "OK",
      details: "Not yet created (will be created on first discovery)",
    });
  }

  return {
    checks,
    success: !checks.some((c) => c.status === "FAIL"),
  };
}

/**
 * Prints doctor results to console with formatting.
 */
export function printDoctorReport(result: DoctorResult): void {
  console.log(pc.bold("\nagy-resume doctor\n"));

  const maxNameLen = Math.max(...result.checks.map((c) => c.name.length), 20);

  for (const check of result.checks) {
    let statusLabel: string;
    switch (check.status) {
      case "OK":
        statusLabel = pc.green(pc.bold("OK       "));
        break;
      case "WARN":
        statusLabel = pc.yellow(pc.bold("WARN     "));
        break;
      case "NOT FOUND":
        statusLabel = pc.red(pc.bold("NOT FOUND"));
        break;
      case "FAIL":
        statusLabel = pc.red(pc.bold("FAIL     "));
        break;
    }

    const paddedName = check.name.padEnd(maxNameLen + 2);
    console.log(`  ${paddedName} ${statusLabel}  ${check.details}`);
  }

  console.log("");

  const remediations = result.checks.filter((c) => c.remediation);
  if (remediations.length > 0) {
    console.log(pc.bold(pc.yellow("Recommendations:")));
    for (const item of remediations) {
      console.log(`\n  ${pc.bold(item.name)}:`);
      console.log(`  ${item.remediation}`);
    }
    console.log("");
  } else {
    console.log(pc.green("No problems detected.\n"));
  }
}

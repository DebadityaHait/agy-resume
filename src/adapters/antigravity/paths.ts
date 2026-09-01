import os from "node:os";
import path from "node:path";

export interface AntigravityPaths {
  dataDir: string;
  historyFile: string;
  cacheDir: string;
  metadataFile: string;
  lastConversationsFile: string;
  brainDir: string;
}

/**
 * Resolves the Antigravity data directory based on precedence:
 * 1. CLI option
 * 2. Environment variable AGY_RESUME_DATA_DIR
 * 3. Default ~/.gemini/antigravity-cli
 */
export function resolveAntigravityDataDir(explicitDataDir?: string): string {
  if (explicitDataDir && explicitDataDir.trim()) {
    return path.resolve(explicitDataDir.trim());
  }

  const envDir = process.env.AGY_RESUME_DATA_DIR;
  if (envDir && envDir.trim()) {
    return path.resolve(envDir.trim());
  }

  return path.join(os.homedir(), ".gemini", "antigravity-cli");
}

/**
 * Returns structured paths for all Antigravity data artifacts.
 */
export function getAntigravityPaths(dataDir: string): AntigravityPaths {
  const resolved = path.resolve(dataDir);
  return {
    dataDir: resolved,
    historyFile: path.join(resolved, "history.jsonl"),
    cacheDir: path.join(resolved, "cache"),
    metadataFile: path.join(resolved, "cache", "conversation_metadata.json"),
    lastConversationsFile: path.join(resolved, "cache", "last_conversations.json"),
    brainDir: path.join(resolved, "brain"),
  };
}

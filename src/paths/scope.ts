import fs from "node:fs";
import path from "node:path";
import type { Session, ScopeMode } from "../types.js";
import { areWorkspacesEqual, isSubdirectoryOf, normalizeWorkspacePath } from "./normalize.js";
import { NotInGitRepositoryError } from "../utils/errors.js";

/**
 * Finds the Git repository root directory by walking up from startDir.
 * Works without spawning git process, safe and fast.
 */
export function findGitRepoRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current && current !== root) {
    const gitPath = path.join(current, ".git");
    try {
      if (fs.existsSync(gitPath)) {
        return normalizeWorkspacePath(current);
      }
    } catch {
      // Permission errors, ignore and continue up
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Check root as well
  const rootGit = path.join(root, ".git");
  try {
    if (fs.existsSync(rootGit)) {
      return normalizeWorkspacePath(root);
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Filters a list of sessions according to the requested ScopeMode.
 */
export function filterSessionsByScope(
  sessions: Session[],
  targetWorkspace: string,
  scope: ScopeMode = "exact",
  platform: NodeJS.Platform = process.platform
): Session[] {
  if (scope === "all") {
    return sessions;
  }

  const normalizedTarget = normalizeWorkspacePath(targetWorkspace, { platform });

  if (scope === "exact") {
    return sessions.filter((session) =>
      areWorkspacesEqual(session.workspace, normalizedTarget, platform)
    );
  }

  if (scope === "tree") {
    return sessions.filter(
      (session) =>
        areWorkspacesEqual(session.workspace, normalizedTarget, platform) ||
        isSubdirectoryOf(normalizedTarget, session.workspace, platform)
    );
  }

  if (scope === "repo") {
    const gitRoot = findGitRepoRoot(normalizedTarget);
    if (!gitRoot) {
      throw new NotInGitRepositoryError(targetWorkspace);
    }

    return sessions.filter(
      (session) =>
        areWorkspacesEqual(session.workspace, gitRoot, platform) ||
        isSubdirectoryOf(gitRoot, session.workspace, platform)
    );
  }

  return sessions;
}

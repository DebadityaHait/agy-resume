import fs from "node:fs";
import path from "node:path";

export interface NormalizeOptions {
  platform?: NodeJS.Platform | undefined;
  resolveRealpath?: boolean | undefined;
}

/**
 * Normalizes a workspace path or URI across platforms.
 * Handles Windows drive letters, slashes, UNC paths, URI encoding, trailing slashes,
 * and relative path resolution.
 */
export function normalizeWorkspacePath(
  input: string,
  options: NormalizeOptions = {}
): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  const platform = options.platform ?? process.platform;
  let raw = input.trim();

  // Convert file:// URI to raw path
  if (raw.startsWith("file://")) {
    let withoutScheme = raw.slice(7); // Strip "file://"
    try {
      withoutScheme = decodeURIComponent(withoutScheme);
    } catch {
      // Ignore URI decode errors
    }

    // If URI was file:///C:/path or file:///c:/path
    if (/^\/[a-zA-Z]:/.test(withoutScheme)) {
      raw = withoutScheme.slice(1);
    } else {
      raw = withoutScheme;
    }
  }

  const isWindowsPath = /^[a-zA-Z]:/.test(raw) || raw.startsWith("\\\\");

  if (platform === "win32" || isWindowsPath) {
    return normalizeWindowsPath(raw, options.resolveRealpath ?? false);
  } else {
    return normalizePosixPath(raw, options.resolveRealpath ?? false);
  }
}

/**
 * Normalizes a Windows path.
 */
function normalizeWindowsPath(rawPath: string, resolveRealpath: boolean): string {
  // Convert forward slashes to backslashes
  let normalized = rawPath.replace(/\//g, "\\");

  // Check if UNC path (starts with \\)
  const isUnc = normalized.startsWith("\\\\");

  // Normalize path using path.win32
  normalized = path.win32.normalize(normalized);

  // Standardize Windows Drive Letter (e.g. "c:" -> "C:")
  if (/^[a-zA-Z]:/.test(normalized)) {
    const drive = normalized[0]!.toUpperCase();
    normalized = drive + normalized.slice(1);
  }

  // Strip trailing backslash unless it's root (e.g. "C:\" or UNC "\\server\share")
  if (normalized.length > 3 && normalized.endsWith("\\")) {
    normalized = normalized.slice(0, -1);
  } else if (/^[A-Z]:\\$/.test(normalized)) {
    // Keep C:\ as is
  } else if (isUnc && normalized.endsWith("\\") && normalized.split("\\").filter(Boolean).length <= 2) {
    // Keep UNC root as is
  } else if (normalized.endsWith("\\") && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }

  if (resolveRealpath) {
    try {
      normalized = fs.realpathSync.native(normalized);
      // Ensure drive letter is uppercase after realpath
      if (/^[a-zA-Z]:/.test(normalized)) {
        normalized = normalized[0]!.toUpperCase() + normalized.slice(1);
      }
    } catch {
      // Fallback to non-realpath on error
    }
  }

  return normalized;
}

/**
 * Normalizes a POSIX path.
 */
function normalizePosixPath(rawPath: string, resolveRealpath: boolean): string {
  let normalized = rawPath.replace(/\\/g, "/");

  normalized = path.posix.normalize(normalized);

  // Strip trailing slash unless root
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  if (resolveRealpath) {
    try {
      normalized = fs.realpathSync(normalized);
    } catch {
      // Fallback to non-realpath on error
    }
  }

  return normalized;
}

/**
 * Checks whether two workspace paths are equivalent under platform rules.
 */
export function areWorkspacesEqual(
  pathA: string,
  pathB: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  if (!pathA || !pathB) return false;

  const normA = normalizeWorkspacePath(pathA, { platform });
  const normB = normalizeWorkspacePath(pathB, { platform });

  const isWindowsA = /^[a-zA-Z]:/.test(normA) || normA.startsWith("\\\\");
  const isWindowsB = /^[a-zA-Z]:/.test(normB) || normB.startsWith("\\\\");

  if (platform === "win32" || isWindowsA || isWindowsB) {
    return normA.toLowerCase() === normB.toLowerCase();
  }

  return normA === normB;
}

/**
 * Checks whether childPath is a descendant subdirectory of parentPath.
 * Avoids simple string prefix bugs (e.g. /app vs /application).
 */
export function isSubdirectoryOf(
  parentPath: string,
  childPath: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  if (!parentPath || !childPath) return false;

  const normParent = normalizeWorkspacePath(parentPath, { platform });
  const normChild = normalizeWorkspacePath(childPath, { platform });

  const isWindowsParent = /^[a-zA-Z]:/.test(normParent) || normParent.startsWith("\\\\");
  const isWindowsChild = /^[a-zA-Z]:/.test(normChild) || normChild.startsWith("\\\\");

  if (platform === "win32" || isWindowsParent || isWindowsChild) {
    const parentDrive = /^[a-zA-Z]:/.test(normParent) ? normParent.slice(0, 2).toUpperCase() : "";
    const childDrive = /^[a-zA-Z]:/.test(normChild) ? normChild.slice(0, 2).toUpperCase() : "";
    if (parentDrive && childDrive && parentDrive !== childDrive) {
      return false;
    }

    const rel = path.win32.relative(normParent.toLowerCase(), normChild.toLowerCase());
    return Boolean(rel && rel !== "." && !rel.startsWith("..") && !path.win32.isAbsolute(rel));
  } else {
    const rel = path.posix.relative(normParent, normChild);
    return Boolean(rel && rel !== "." && !rel.startsWith("..") && !path.posix.isAbsolute(rel));
  }
}

import path from "node:path";
import pc from "picocolors";
import type { Session } from "../types.js";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a Date into a friendly, deterministic relative time string.
 */
export function formatRelativeTime(date?: Date, now: Date = new Date()): string {
  if (!date || isNaN(date.getTime())) {
    return "";
  }

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return "just now";
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  if (diffDay < 30) {
    return `${diffDay}d ago`;
  }

  // Format as "MMM DD" or "YYYY-MM-DD"
  const sameYear = now.getFullYear() === date.getFullYear();
  if (sameYear) {
    const month = MONTH_NAMES[date.getMonth()] ?? "";
    const day = date.getDate();
    return `${month} ${day}`;
  }

  const year = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * Formats a step count number into a friendly label (e.g. "1 step", "12 steps").
 */
export function formatStepCount(count?: number): string {
  if (typeof count !== "number" || isNaN(count) || count <= 0) {
    return "";
  }
  return count === 1 ? "1 step" : `${count} steps`;
}

/**
 * Extracts a compact directory / folder name from a workspace path.
 */
export function extractWorkspaceDir(workspace?: string): string {
  if (!workspace || !workspace.trim()) return "";
  const trimmed = workspace.trim();
  const base = path.basename(trimmed);
  if (base && base !== "/" && base !== "\\") {
    return base;
  }
  return trimmed;
}

/**
 * Truncates string to maxWidth columns, appending '...' if truncated.
 * Handles Unicode safely.
 */
export function truncateString(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  const chars = Array.from(str);
  if (chars.length <= maxWidth) {
    return str;
  }
  if (maxWidth <= 3) {
    return chars.slice(0, maxWidth).join("");
  }
  return chars.slice(0, maxWidth - 3).join("") + "...";
}

/**
 * Formats an interactive picker row with title, directory, step count, and relative time,
 * aligned in fixed-width columns matching native Antigravity CLI.
 */
export function renderSessionRow(
  session: Session,
  isSelected: boolean,
  columns: number = 80,
  now: Date = new Date()
): string {
  const timeStr = formatRelativeTime(session.updatedAt || session.createdAt, now);
  const stepsStr = formatStepCount(session.messageCount);
  const dirStr = extractWorkspaceDir(session.workspace);

  // Prefix: "> " or "  "
  const prefix = isSelected ? pc.cyan(pc.bold("> ")) : "  ";
  const prefixLen = 2;

  // Determine which metadata columns fit based on terminal width
  const showDir = Boolean(dirStr && columns >= 75);
  const showSteps = Boolean(stepsStr && columns >= 55);
  const showTime = Boolean(timeStr);

  const dirColWidth = showDir ? Math.min(18, Math.max(10, Math.floor(columns * 0.18))) : 0;
  const stepsColWidth = showSteps ? 12 : 0;
  const timeColWidth = showTime ? 10 : 0;

  // Spacing between columns (2 spaces per column gap)
  let totalMetaWidth = 0;
  if (showDir) totalMetaWidth += dirColWidth + 2;
  if (showSteps) totalMetaWidth += stepsColWidth + 2;
  if (showTime) totalMetaWidth += timeColWidth;

  const availableTitleWidth = Math.max(10, columns - prefixLen - totalMetaWidth - 2);
  const title = session.title || session.firstPrompt || session.id.slice(0, 8);
  const truncatedTitle = truncateString(title, availableTitleWidth);

  // Remaining space between title and first metadata column
  const paddingLen = Math.max(2, columns - prefixLen - truncatedTitle.length - totalMetaWidth);
  const padding = " ".repeat(paddingLen);

  const metaParts: string[] = [];

  if (showDir) {
    const truncatedDir = truncateString(dirStr, dirColWidth);
    const rightAlignedDir = truncatedDir.padStart(dirColWidth, " ");
    metaParts.push(pc.dim(rightAlignedDir));
  }

  if (showSteps) {
    const rightAlignedSteps = stepsStr.padStart(stepsColWidth, " ");
    metaParts.push(pc.dim(rightAlignedSteps));
  }

  if (showTime) {
    const rightAlignedTime = timeStr.padStart(timeColWidth, " ");
    metaParts.push(isSelected ? pc.cyan(rightAlignedTime) : pc.dim(rightAlignedTime));
  }

  const formattedMeta = metaParts.join("  ");

  if (isSelected) {
    return prefix + pc.bold(pc.white(truncatedTitle)) + padding + formattedMeta;
  } else {
    return prefix + truncatedTitle + padding + formattedMeta;
  }
}

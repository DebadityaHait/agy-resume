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
 * Formats an interactive picker row with title, step count, and relative time.
 */
export function renderSessionRow(
  session: Session,
  isSelected: boolean,
  columns: number = 80,
  now: Date = new Date()
): string {
  const timeStr = formatRelativeTime(session.updatedAt || session.createdAt, now);
  const stepsStr = formatStepCount(session.messageCount);

  // Show steps if terminal width is adequate (>= 50 cols)
  const showSteps = Boolean(stepsStr && columns >= 50);

  const metaParts: string[] = [];
  if (showSteps) {
    metaParts.push(stepsStr);
  }
  if (timeStr) {
    metaParts.push(timeStr);
  }

  const rawMeta = metaParts.join("   ");
  const metaColWidth = rawMeta ? rawMeta.length + 2 : 0;

  // Prefix: "> " or "  "
  const prefix = isSelected ? pc.cyan(pc.bold("> ")) : "  ";
  const prefixLen = 2;

  const availableTitleWidth = Math.max(10, columns - prefixLen - metaColWidth - 2);
  const title = session.title || session.firstPrompt || session.id.slice(0, 8);
  const truncatedTitle = truncateString(title, availableTitleWidth);

  // Pad title so metadata aligns nicely to the right
  const paddingLen = Math.max(1, columns - prefixLen - truncatedTitle.length - rawMeta.length - 2);
  const padding = " ".repeat(paddingLen);

  let formattedMeta = "";
  if (showSteps && timeStr) {
    if (isSelected) {
      formattedMeta = `${pc.dim(stepsStr)}   ${pc.cyan(timeStr)}`;
    } else {
      formattedMeta = `${pc.dim(stepsStr)}   ${pc.dim(timeStr)}`;
    }
  } else if (showSteps) {
    formattedMeta = isSelected ? pc.cyan(stepsStr) : pc.dim(stepsStr);
  } else if (timeStr) {
    formattedMeta = isSelected ? pc.cyan(timeStr) : pc.dim(timeStr);
  }

  if (isSelected) {
    return prefix + pc.bold(pc.white(truncatedTitle)) + padding + formattedMeta;
  } else {
    return prefix + truncatedTitle + padding + formattedMeta;
  }
}

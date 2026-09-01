import type { Session } from "../types.js";

/**
 * Filters sessions by search query across title, firstPrompt, id, and workspace.
 * Case-insensitive, multi-word matching.
 */
export function filterSessionsByQuery(sessions: Session[], query?: string): Session[] {
  if (!query || !query.trim()) {
    return sessions;
  }

  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return sessions;
  }

  return sessions.filter((session) => {
    const title = (session.title || "").toLowerCase();
    const firstPrompt = (session.firstPrompt || "").toLowerCase();
    const id = (session.id || "").toLowerCase();
    const workspace = (session.workspace || "").toLowerCase();

    return terms.every(
      (term) =>
        title.includes(term) ||
        firstPrompt.includes(term) ||
        id.includes(term) ||
        workspace.includes(term)
    );
  });
}

/**
 * Sorts sessions newest-first.
 * 1. updatedAt descending
 * 2. createdAt descending
 * 3. id descending (deterministic fallback)
 */
export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const timeA = a.updatedAt ? a.updatedAt.getTime() : a.createdAt ? a.createdAt.getTime() : 0;
    const timeB = b.updatedAt ? b.updatedAt.getTime() : b.createdAt ? b.createdAt.getTime() : 0;

    if (timeA !== timeB) {
      return timeB - timeA;
    }

    return b.id.localeCompare(a.id);
  });
}

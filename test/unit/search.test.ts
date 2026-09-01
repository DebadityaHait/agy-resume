import { describe, it, expect } from "vitest";
import type { Session } from "../../src/types.js";
import { filterSessionsByQuery, sortSessions } from "../../src/discovery/search.js";
import { formatRelativeTime, formatStepCount, truncateString, renderSessionRow } from "../../src/ui/format.js";

const sampleSessions: Session[] = [
  {
    id: "055a398f-db14-4c5f-abbb-1bf03f8120a7",
    workspace: "C:\\Projects\\ticktick",
    title: "TickTick Patcher Local Execution",
    firstPrompt: "Execute the patcher locally...",
    updatedAt: new Date("2026-09-01T19:14:55.000Z"),
    messageCount: 25,
    source: "antigravity",
  },
  {
    id: "2c2c1454-6417-4f0f-8cbd-0aee756cd6d5",
    workspace: "C:\\Projects\\ticktick",
    title: "Fix authentication failure",
    firstPrompt: "Investigate why authentication token expired",
    updatedAt: new Date("2026-08-30T10:00:00.000Z"),
    messageCount: 1,
    source: "antigravity",
  },
  {
    id: "38dd91e1-f0c2-4933-bf50-f6880897b92c",
    workspace: "C:\\Projects\\domains",
    title: "Two Letter Domain Scraper",
    firstPrompt: "Scraping domains...",
    updatedAt: new Date("2026-08-25T15:00:00.000Z"),
    messageCount: 5,
    source: "antigravity",
  },
];

describe("search & sort", () => {
  describe("filterSessionsByQuery", () => {
    it("returns all sessions when query is empty or whitespace", () => {
      expect(filterSessionsByQuery(sampleSessions, "")).toEqual(sampleSessions);
      expect(filterSessionsByQuery(sampleSessions, "   ")).toEqual(sampleSessions);
    });

    it("filters by single keyword case-insensitively", () => {
      const results = filterSessionsByQuery(sampleSessions, "AUTHENTICATION");
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe("2c2c1454-6417-4f0f-8cbd-0aee756cd6d5");
    });

    it("filters by multiple words across title/prompt", () => {
      const results = filterSessionsByQuery(sampleSessions, "fix token");
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe("2c2c1454-6417-4f0f-8cbd-0aee756cd6d5");
    });

    it("filters by session id", () => {
      const results = filterSessionsByQuery(sampleSessions, "38dd91e1");
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe("38dd91e1-f0c2-4933-bf50-f6880897b92c");
    });
  });

  describe("sortSessions", () => {
    it("sorts newest first by updatedAt", () => {
      const sorted = sortSessions(sampleSessions);
      expect(sorted[0]?.id).toBe("055a398f-db14-4c5f-abbb-1bf03f8120a7"); // Sept 1
      expect(sorted[1]?.id).toBe("2c2c1454-6417-4f0f-8cbd-0aee756cd6d5"); // Aug 30
      expect(sorted[2]?.id).toBe("38dd91e1-f0c2-4933-bf50-f6880897b92c"); // Aug 25
    });
  });

  describe("formatRelativeTime", () => {
    const fixedNow = new Date("2026-09-01T20:00:00.000Z");

    it("formats minutes ago", () => {
      const date = new Date("2026-09-01T19:57:00.000Z");
      expect(formatRelativeTime(date, fixedNow)).toBe("3m ago");
    });

    it("formats hours ago", () => {
      const date = new Date("2026-09-01T18:00:00.000Z");
      expect(formatRelativeTime(date, fixedNow)).toBe("2h ago");
    });

    it("formats days ago", () => {
      const date = new Date("2026-08-30T20:00:00.000Z");
      expect(formatRelativeTime(date, fixedNow)).toBe("2d ago");
    });

    it("formats date in same year", () => {
      const date = new Date("2026-05-15T12:00:00.000Z");
      expect(formatRelativeTime(date, fixedNow)).toBe("May 15");
    });
  });

  describe("formatStepCount", () => {
    it("formats single step as '1 step'", () => {
      expect(formatStepCount(1)).toBe("1 step");
    });

    it("formats multiple steps as 'N steps'", () => {
      expect(formatStepCount(25)).toBe("25 steps");
    });

    it("returns empty string for 0 or invalid", () => {
      expect(formatStepCount(0)).toBe("");
      expect(formatStepCount(undefined)).toBe("");
    });
  });

  describe("truncateString", () => {
    it("preserves short string", () => {
      expect(truncateString("Short string", 20)).toBe("Short string");
    });

    it("truncates long string and adds ellipsis", () => {
      expect(truncateString("This is a very long session title", 15)).toBe("This is a ve...");
    });
  });

  describe("renderSessionRow", () => {
    const fixedNow = new Date("2026-09-01T20:00:00.000Z");

    it("renders row with title, step count, and relative time", () => {
      const row = renderSessionRow(sampleSessions[0]!, true, 80, fixedNow);
      expect(row).toContain("TickTick Patcher Local Execution");
      expect(row).toContain("25 steps");
      expect(row).toContain("45m ago");
    });
  });
});

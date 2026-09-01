import { describe, it, expect } from "vitest";
import type { Session } from "../../src/types.js";
import { filterSessionsByScope } from "../../src/paths/scope.js";
import { NotInGitRepositoryError } from "../../src/utils/errors.js";

const sampleSessions: Session[] = [
  {
    id: "sess-1",
    workspace: "C:\\Projects\\my-app",
    title: "Root Session",
    source: "antigravity",
  },
  {
    id: "sess-2",
    workspace: "C:\\Projects\\my-app\\packages\\core",
    title: "Core Package Session",
    source: "antigravity",
  },
  {
    id: "sess-3",
    workspace: "C:\\Projects\\my-app-other",
    title: "Other Project Session",
    source: "antigravity",
  },
  {
    id: "sess-4",
    workspace: "C:\\Projects\\different",
    title: "Different Project Session",
    source: "antigravity",
  },
];

describe("filterSessionsByScope", () => {
  describe("exact scope", () => {
    it("matches only exact workspace", () => {
      const results = filterSessionsByScope(
        sampleSessions,
        "c:\\projects\\my-app",
        "exact",
        "win32"
      );
      expect(results.map((s) => s.id)).toEqual(["sess-1"]);
    });

    it("matches exact nested workspace", () => {
      const results = filterSessionsByScope(
        sampleSessions,
        "C:\\Projects\\my-app\\packages\\core",
        "exact",
        "win32"
      );
      expect(results.map((s) => s.id)).toEqual(["sess-2"]);
    });

    it("returns empty when no sessions match exact workspace", () => {
      const results = filterSessionsByScope(
        sampleSessions,
        "C:\\Projects\\unknown",
        "exact",
        "win32"
      );
      expect(results).toEqual([]);
    });
  });

  describe("tree scope", () => {
    it("matches exact workspace and all descendant subdirectories", () => {
      const results = filterSessionsByScope(
        sampleSessions,
        "C:\\Projects\\my-app",
        "tree",
        "win32"
      );
      expect(results.map((s) => s.id)).toEqual(["sess-1", "sess-2"]);
    });

    it("does not match siblings with prefix traps", () => {
      const results = filterSessionsByScope(
        sampleSessions,
        "C:\\Projects\\my-app",
        "tree",
        "win32"
      );
      expect(results.some((s) => s.id === "sess-3")).toBe(false);
    });
  });

  describe("all scope", () => {
    it("returns all sessions regardless of workspace", () => {
      const results = filterSessionsByScope(
        sampleSessions,
        "C:\\Projects\\my-app",
        "all",
        "win32"
      );
      expect(results.length).toBe(4);
    });
  });

  describe("repo scope", () => {
    it("throws NotInGitRepositoryError if target directory has no git repo", () => {
      // D:\non-existent-or-root
      expect(() =>
        filterSessionsByScope(sampleSessions, "C:\\FakeNonExistentRepoDir12345", "repo", "win32")
      ).toThrow(NotInGitRepositoryError);
    });
  });
});

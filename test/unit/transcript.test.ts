import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  extractCleanUserPrompt,
  parseDateSafe,
} from "../../src/adapters/antigravity/schema.js";
import { parseTranscriptSummary } from "../../src/adapters/antigravity/transcript.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");

describe("transcript helpers", () => {
  describe("extractCleanUserPrompt", () => {
    it("extracts text within <USER_REQUEST> tags", () => {
      const input = `<USER_REQUEST>\nFix authentication failure\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nSome metadata\n</ADDITIONAL_METADATA>`;
      expect(extractCleanUserPrompt(input)).toBe("Fix authentication failure");
    });

    it("collapses multi-line whitespace and removes metadata tags", () => {
      const input = `<USER_REQUEST>\nFirst line\n  second line\nthird line\n</USER_REQUEST>`;
      expect(extractCleanUserPrompt(input)).toBe("First line second line third line");
    });

    it("handles plain string when no tags are present", () => {
      const input = "Simple prompt without any XML tags";
      expect(extractCleanUserPrompt(input)).toBe("Simple prompt without any XML tags");
    });
  });

  describe("parseDateSafe", () => {
    it("parses ISO strings", () => {
      const date = parseDateSafe("2026-09-01T18:20:30.000Z");
      expect(date).toBeInstanceOf(Date);
      expect(date?.toISOString()).toBe("2026-09-01T18:20:30.000Z");
    });

    it("parses epoch timestamps", () => {
      const date = parseDateSafe(1788098008004);
      expect(date).toBeInstanceOf(Date);
      expect(date?.getTime()).toBe(1788098008004);
    });

    it("returns undefined for invalid inputs", () => {
      expect(parseDateSafe(null)).toBeUndefined();
      expect(parseDateSafe("invalid-date-string")).toBeUndefined();
    });
  });

  describe("parseTranscriptSummary", () => {
    it("parses transcript.jsonl and extracts prompt, step count, and timestamps", async () => {
      const transcriptPath = path.join(
        FIXTURES_DIR,
        "standard",
        "brain",
        "conv-ticktick-1",
        ".system_generated",
        "logs",
        "transcript.jsonl"
      );
      const summary = await parseTranscriptSummary(transcriptPath);

      expect(summary).not.toBeNull();
      expect(summary?.firstPrompt).toBe("Check the local TickTick patcher requirements");
      expect(summary?.stepCount).toBe(3);
      expect(summary?.createdAt).toEqual(new Date("2026-09-01T18:00:00Z"));
      expect(summary?.updatedAt).toEqual(new Date("2026-09-01T18:20:30Z"));
    });

    it("returns null for non-existent file", async () => {
      const summary = await parseTranscriptSummary(
        path.join(FIXTURES_DIR, "nonexistent", "transcript.jsonl")
      );
      expect(summary).toBeNull();
    });
  });
});

import fs from "node:fs";
import readline from "node:readline";
import { extractCleanUserPrompt, parseDateSafe, type ParsedTranscriptSummary } from "./schema.js";

/**
 * Parses transcript summary metadata from a transcript.jsonl file.
 * Safely streams lines to avoid loading large files into memory.
 */
export async function parseTranscriptSummary(
  transcriptFilePath: string
): Promise<ParsedTranscriptSummary | null> {
  if (!fs.existsSync(transcriptFilePath)) {
    return null;
  }

  let firstPrompt: string | undefined;
  let createdAt: Date | undefined;
  let updatedAt: Date | undefined;
  let stepCount = 0;

  try {
    const fileStream = fs.createReadStream(transcriptFilePath, { encoding: "utf-8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Skip malformed/truncated line
        continue;
      }

      if (!parsed || typeof parsed !== "object") continue;

      stepCount++;
      const step = parsed as Record<string, unknown>;

      const stepDate = parseDateSafe(step.created_at);
      if (stepDate) {
        if (!createdAt) {
          createdAt = stepDate;
        }
        updatedAt = stepDate;
      }

      // Extract first user input prompt
      if (!firstPrompt && (step.type === "USER_INPUT" || step.source === "USER_EXPLICIT")) {
        if (typeof step.content === "string") {
          const clean = extractCleanUserPrompt(step.content);
          if (clean) {
            firstPrompt = clean;
          }
        }
      }
    }
  } catch {
    // If stream fails unexpectedly, return what was parsed so far if any
  }

  // Fallback to file mtime if no dates found in transcript steps
  if (!updatedAt) {
    try {
      const stat = fs.statSync(transcriptFilePath);
      updatedAt = stat.mtime;
      if (!createdAt) {
        createdAt = stat.birthtime || stat.mtime;
      }
    } catch {
      // Ignore
    }
  }

  return {
    firstPrompt,
    createdAt,
    updatedAt,
    stepCount,
  };
}

import fs from "node:fs";
import readline from "node:readline";
import { parseHistoryRecord } from "./schema.js";

export interface AggregatedHistorySession {
  conversationId: string;
  workspace: string;
  firstDisplay?: string | undefined;
  lastDisplay?: string | undefined;
  firstTimestamp?: number | undefined;
  lastTimestamp?: number | undefined;
  historyCount: number;
}

export interface ParseHistoryResult {
  sessions: Map<string, AggregatedHistorySession>;
  totalLines: number;
  validRecords: number;
  malformedLines: number;
}

/**
 * Parses history.jsonl in a streaming fashion.
 * Groups entries by conversationId, maintaining first and last timestamps/displays.
 */
export async function parseHistoryFile(historyFilePath: string): Promise<ParseHistoryResult> {
  const result: ParseHistoryResult = {
    sessions: new Map(),
    totalLines: 0,
    validRecords: 0,
    malformedLines: 0,
  };

  if (!fs.existsSync(historyFilePath)) {
    return result;
  }

  const fileStream = fs.createReadStream(historyFilePath, { encoding: "utf-8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let currentWorkspaceFallback = "";

  for await (const line of rl) {
    result.totalLines++;
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      result.malformedLines++;
      continue;
    }

    const record = parseHistoryRecord(parsedJson);
    if (!record) {
      result.malformedLines++;
      continue;
    }

    result.validRecords++;

    if (record.workspace) {
      currentWorkspaceFallback = record.workspace;
    }

    const convId = record.conversationId;
    if (!convId) {
      continue;
    }

    const workspace = record.workspace || currentWorkspaceFallback;
    const existing = result.sessions.get(convId);

    if (!existing) {
      result.sessions.set(convId, {
        conversationId: convId,
        workspace,
        firstDisplay: record.display,
        lastDisplay: record.display,
        firstTimestamp: record.timestamp,
        lastTimestamp: record.timestamp,
        historyCount: 1,
      });
    } else {
      existing.historyCount++;
      if (workspace && !existing.workspace) {
        existing.workspace = workspace;
      }
      if (record.display) {
        existing.lastDisplay = record.display;
        if (!existing.firstDisplay) {
          existing.firstDisplay = record.display;
        }
      }
      if (record.timestamp) {
        if (!existing.firstTimestamp || record.timestamp < existing.firstTimestamp) {
          existing.firstTimestamp = record.timestamp;
        }
        if (!existing.lastTimestamp || record.timestamp > existing.lastTimestamp) {
          existing.lastTimestamp = record.timestamp;
        }
      }
    }
  }

  return result;
}

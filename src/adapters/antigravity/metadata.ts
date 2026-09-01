import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseDateSafe, type ParsedConversationMetadata } from "./schema.js";

export interface ParseMetadataResult {
  conversations: Map<string, ParsedConversationMetadata>;
  lastConversations: Map<string, string>; // workspace -> id
}

/**
 * Parses Antigravity metadata files (conversation_metadata.json and last_conversations.json).
 */
export async function parseMetadataFiles(
  metadataFilePath: string,
  lastConversationsFilePath: string
): Promise<ParseMetadataResult> {
  const result: ParseMetadataResult = {
    conversations: new Map(),
    lastConversations: new Map(),
  };

  // Parse conversation_metadata.json
  if (existsSync(metadataFilePath)) {
    try {
      const content = await fs.readFile(metadataFilePath, "utf-8");
      const data = JSON.parse(content) as unknown;

      if (data && typeof data === "object" && "conversations" in data) {
        const convs = (data as { conversations?: Record<string, unknown> }).conversations;
        if (convs && typeof convs === "object") {
          for (const [id, entry] of Object.entries(convs)) {
            if (!entry || typeof entry !== "object") continue;
            const entryObj = entry as { summary?: Record<string, unknown> };
            const summary = entryObj.summary;
            if (!summary || typeof summary !== "object") continue;

            const convId = typeof summary.ID === "string" ? summary.ID.trim() : id;
            const title = typeof summary.Title === "string" && summary.Title.trim() ? summary.Title.trim() : undefined;
            const preview = typeof summary.Preview === "string" && summary.Preview.trim() ? summary.Preview.trim() : undefined;
            const numSteps = typeof summary.NumSteps === "number" ? summary.NumSteps : undefined;
            const updatedAt = parseDateSafe(summary.UpdatedAt);

            let workspaceURIs: string[] | undefined;
            if (Array.isArray(summary.WorkspaceURIs)) {
              workspaceURIs = summary.WorkspaceURIs.filter((uri): uri is string => typeof uri === "string");
            }

            result.conversations.set(convId, {
              id: convId,
              title,
              preview,
              numSteps,
              updatedAt,
              workspaceURIs,
            });
          }
        }
      }
    } catch {
      // Gracefully ignore corrupt metadata cache
    }
  }

  // Parse last_conversations.json
  if (existsSync(lastConversationsFilePath)) {
    try {
      const content = await fs.readFile(lastConversationsFilePath, "utf-8");
      const data = JSON.parse(content) as unknown;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const [workspace, id] of Object.entries(data as Record<string, unknown>)) {
          if (typeof workspace === "string" && typeof id === "string") {
            result.lastConversations.set(workspace, id);
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return result;
}

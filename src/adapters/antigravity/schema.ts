/**
 * Types and validation guards for Antigravity raw storage formats.
 */

export interface ParsedHistoryEntry {
  workspace: string;
  conversationId?: string | undefined;
  display?: string | undefined;
  timestamp?: number | undefined;
  type?: string | undefined;
}

export interface ParsedConversationMetadata {
  id: string;
  title?: string | undefined;
  preview?: string | undefined;
  numSteps?: number | undefined;
  updatedAt?: Date | undefined;
  workspaceURIs?: string[] | undefined;
}

export interface ParsedTranscriptSummary {
  firstPrompt?: string | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
  stepCount: number;
}

/**
 * Validates whether an unknown parsed JSON object is a history record.
 */
export function parseHistoryRecord(raw: unknown): ParsedHistoryEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  const workspace = typeof obj.workspace === "string" ? obj.workspace.trim() : "";
  const conversationId = typeof obj.conversationId === "string" ? obj.conversationId.trim() : undefined;
  const display = typeof obj.display === "string" ? obj.display.trim() : undefined;
  const timestamp = typeof obj.timestamp === "number" ? obj.timestamp : undefined;
  const type = typeof obj.type === "string" ? obj.type.trim() : undefined;

  // Record must have at least workspace or conversationId
  if (!workspace && !conversationId) {
    return null;
  }

  return {
    workspace,
    conversationId,
    display,
    timestamp,
    type,
  };
}

/**
 * Extracts and sanitizes the user prompt from transcript content.
 * Strips <USER_REQUEST>, <ADDITIONAL_METADATA>, <USER_SETTINGS_CHANGE>, etc.
 */
export function extractCleanUserPrompt(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  let text = content.trim();

  // Match <USER_REQUEST> block if present
  const userRequestMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  if (userRequestMatch && userRequestMatch[1]) {
    text = userRequestMatch[1].trim();
  }

  // Remove other metadata blocks if still present
  text = text
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, "")
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, "")
    .replace(/<system_instructions>[\s\S]*?<\/system_instructions>/gi, "")
    .trim();

  // Collapse multiple whitespace/newlines into clean single space
  return text.replace(/\s+/g, " ");
}

/**
 * Parses ISO 8601 date string or epoch milliseconds into Date safely.
 */
export function parseDateSafe(input: unknown): Date | undefined {
  if (input instanceof Date && !isNaN(input.getTime())) {
    return input;
  }

  if (typeof input === "number" && !isNaN(input) && input > 0) {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d;
  }

  if (typeof input === "string" && input.trim()) {
    const d = new Date(input.trim());
    if (!isNaN(d.getTime())) return d;
  }

  return undefined;
}

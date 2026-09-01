import fs from "node:fs";
import path from "node:path";
import type { DiscoveryOptions, DiscoveryResult, Session, SessionSource } from "../../types.js";
import { resolveAntigravityDataDir, getAntigravityPaths } from "./paths.js";
import { parseHistoryFile } from "./history.js";
import { parseMetadataFiles } from "./metadata.js";
import { parseTranscriptSummary } from "./transcript.js";
import { normalizeWorkspacePath } from "../../paths/normalize.js";
import { filterSessionsByScope } from "../../paths/scope.js";
import { AntigravityDataNotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

interface IntermediateSession {
  id: string;
  workspace: string;
  title?: string | undefined;
  firstPrompt?: string | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
  messageCount?: number | undefined;
}

export class AntigravityAdapter implements SessionSource {
  async discoverSessions(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
    const dataDir = resolveAntigravityDataDir(options.dataDir);
    const paths = getAntigravityPaths(dataDir);
    const warnings: string[] = [];

    logger.debug(`Using Antigravity data dir: ${dataDir}`);

    if (!fs.existsSync(dataDir)) {
      throw new AntigravityDataNotFoundError(dataDir);
    }

    const hasHistory = fs.existsSync(paths.historyFile);
    const hasMetadata = fs.existsSync(paths.metadataFile);
    const hasBrain = fs.existsSync(paths.brainDir);

    if (!hasHistory && !hasMetadata && !hasBrain) {
      throw new AntigravityDataNotFoundError(
        dataDir,
        "Data directory exists but contains no history.jsonl, cache, or brain folders."
      );
    }

    // Step 1: Parse history.jsonl
    const historyResult = await parseHistoryFile(paths.historyFile);
    if (historyResult.malformedLines > 0) {
      warnings.push(`${historyResult.malformedLines} malformed history line(s) were skipped.`);
      logger.debug(`Malformed history lines: ${historyResult.malformedLines}`);
    }

    // Step 2: Parse metadata cache
    const metadataResult = await parseMetadataFiles(paths.metadataFile, paths.lastConversationsFile);

    // Step 3: Discover all known conversation IDs and their workspaces
    const candidateMap = new Map<string, IntermediateSession>();

    // Add from history
    for (const [id, hist] of historyResult.sessions.entries()) {
      let ws = hist.workspace;
      if (!ws) {
        // Try looking up in lastConversations or metadata
        const meta = metadataResult.conversations.get(id);
        if (meta?.workspaceURIs && meta.workspaceURIs.length > 0) {
          ws = meta.workspaceURIs[0]!;
        }
      }

      candidateMap.set(id, {
        id,
        workspace: ws ? normalizeWorkspacePath(ws) : "",
        firstPrompt: hist.firstDisplay,
        createdAt: hist.firstTimestamp ? new Date(hist.firstTimestamp) : undefined,
        updatedAt: hist.lastTimestamp ? new Date(hist.lastTimestamp) : undefined,
        messageCount: hist.historyCount,
      });
    }

    // Add / enrich from metadata cache
    for (const [id, meta] of metadataResult.conversations.entries()) {
      let ws = "";
      if (meta.workspaceURIs && meta.workspaceURIs.length > 0) {
        ws = meta.workspaceURIs[0]!;
      }

      const existing = candidateMap.get(id);
      if (!existing) {
        candidateMap.set(id, {
          id,
          workspace: ws ? normalizeWorkspacePath(ws) : "",
          title: meta.title,
          firstPrompt: meta.preview,
          updatedAt: meta.updatedAt,
          messageCount: meta.numSteps,
        });
      } else {
        if (!existing.workspace && ws) {
          existing.workspace = normalizeWorkspacePath(ws);
        }
        if (meta.title && !existing.title) {
          existing.title = meta.title;
        }
        if (meta.preview && !existing.firstPrompt) {
          existing.firstPrompt = meta.preview;
        }
        if (meta.updatedAt && !existing.updatedAt) {
          existing.updatedAt = meta.updatedAt;
        }
        if (meta.numSteps && !existing.messageCount) {
          existing.messageCount = meta.numSteps;
        }
      }
    }

    // Also check brain directory for any conversations that might only exist there
    if (fs.existsSync(paths.brainDir)) {
      try {
        const brainEntries = fs.readdirSync(paths.brainDir, { withFileTypes: true });
        for (const entry of brainEntries) {
          if (entry.isDirectory() && !candidateMap.has(entry.name)) {
            // Found a conversation in brain directory
            candidateMap.set(entry.name, {
              id: entry.name,
              workspace: "",
            });
          }
        }
      } catch {
        // Ignore read errors on brain dir
      }
    }

    const totalDiscovered = candidateMap.size;
    logger.debug(`Discovered ${totalDiscovered} total conversation candidate(s)`);

    // Convert candidate sessions to Session array
    const allCandidates: Session[] = Array.from(candidateMap.values()).map((c) => ({
      id: c.id,
      workspace: c.workspace,
      title: c.title,
      firstPrompt: c.firstPrompt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messageCount,
      source: "antigravity",
    }));

    // Step 4: Workspace Scope Filtering (Filter early before reading transcripts!)
    const targetWorkspace = options.cwd ? options.cwd : process.cwd();
    const scope = options.scope ?? "exact";

    let scopedSessions = filterSessionsByScope(allCandidates, targetWorkspace, scope);

    // Step 5: Transcript enrichment for matching sessions that lack title/prompt/timestamp
    const enrichedSessions: Session[] = [];

    for (const session of scopedSessions) {
      let title = session.title;
      let firstPrompt = session.firstPrompt;
      let createdAt = session.createdAt;
      let updatedAt = session.updatedAt;
      let messageCount = session.messageCount;

      // If missing details or workspace, check transcript
      const transcriptPath = path.join(
        paths.brainDir,
        session.id,
        ".system_generated",
        "logs",
        "transcript.jsonl"
      );
      const transcriptFullPath = path.join(
        paths.brainDir,
        session.id,
        ".system_generated",
        "logs",
        "transcript_full.jsonl"
      );

      const targetTranscript = fs.existsSync(transcriptPath)
        ? transcriptPath
        : fs.existsSync(transcriptFullPath)
          ? transcriptFullPath
          : null;

      if (targetTranscript && (!firstPrompt || !createdAt || !updatedAt || !messageCount)) {
        try {
          const summary = await parseTranscriptSummary(targetTranscript);
          if (summary) {
            if (!firstPrompt && summary.firstPrompt) {
              firstPrompt = summary.firstPrompt;
            }
            if (!createdAt && summary.createdAt) {
              createdAt = summary.createdAt;
            }
            if (!updatedAt && summary.updatedAt) {
              updatedAt = summary.updatedAt;
            }
            if (!messageCount && summary.stepCount) {
              messageCount = summary.stepCount;
            }
          }
        } catch {
          // Ignore individual transcript read failure
        }
      }

      // Final fallback for title
      if (!title) {
        title = firstPrompt || session.id.slice(0, 8);
      }

      enrichedSessions.push({
        id: session.id,
        workspace: session.workspace,
        title,
        firstPrompt,
        createdAt,
        updatedAt,
        messageCount,
        source: "antigravity",
      });
    }

    return {
      sessions: enrichedSessions,
      warnings,
      totalDiscovered,
    };
  }
}

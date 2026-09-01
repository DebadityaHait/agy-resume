import type { DiscoveryOptions, DiscoveryResult, Session } from "../types.js";
import { AntigravityAdapter } from "../adapters/antigravity/index.js";
import { resolveAntigravityDataDir } from "../adapters/antigravity/paths.js";
import { readCachedSessions, writeCachedSessions } from "./cache.js";
import { filterSessionsByQuery, sortSessions } from "./search.js";
import { filterSessionsByScope } from "../paths/scope.js";
import { logger } from "../utils/logger.js";

/**
 * Main discovery function that coordinates cache, adapter, scope filtering, search, and sorting.
 */
export async function discoverSessions(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const dataDir = resolveAntigravityDataDir(options.dataDir);
  const targetCwd = options.cwd ? options.cwd : process.cwd();
  const scope = options.scope ?? "exact";
  const noCache = Boolean(options.noCache);
  const refresh = Boolean(options.refresh);

  let allSessions: Session[] | null = null;
  const warnings: string[] = [];

  // Try cache first if applicable
  if (!noCache && !refresh) {
    allSessions = readCachedSessions(dataDir, options.cacheDir);
    if (allSessions) {
      logger.debug(`Loaded ${allSessions.length} sessions from local cache`);
    }
  }

  // If not cached, discover using adapter
  if (!allSessions) {
    const adapter = new AntigravityAdapter();
    // Discover across all workspaces so we can cache globally
    const discovery = await adapter.discoverSessions({
      ...options,
      scope: "all",
    });

    allSessions = discovery.sessions;
    warnings.push(...discovery.warnings);

    // Write to cache if enabled
    if (!noCache) {
      writeCachedSessions(dataDir, allSessions, options.cacheDir);
    }
  }

  const totalDiscovered = allSessions.length;

  // Step 1: Filter by workspace scope
  let filtered = filterSessionsByScope(allSessions, targetCwd, scope);

  // Step 2: Filter by search query if provided
  if (options.query) {
    filtered = filterSessionsByQuery(filtered, options.query);
  }

  // Step 3: Sort newest-first
  filtered = sortSessions(filtered);

  // Step 4: Apply limit if specified
  if (options.limit && options.limit > 0 && filtered.length > options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return {
    sessions: filtered,
    warnings,
    totalDiscovered,
  };
}

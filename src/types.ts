/**
 * Core types for agy-resume
 */

export interface Session {
  id: string;
  workspace: string;
  title?: string | undefined;
  firstPrompt?: string | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
  messageCount?: number | undefined;
  source: "antigravity";
}

export interface JsonSession {
  id: string;
  workspace: string;
  title?: string | undefined;
  firstPrompt?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  messageCount?: number | undefined;
}

export type ScopeMode = "exact" | "repo" | "tree" | "all";

export interface DiscoveryOptions {
  dataDir?: string | undefined;
  cwd?: string | undefined;
  scope?: ScopeMode | undefined;
  limit?: number | undefined;
  query?: string | undefined;
  noCache?: boolean | undefined;
  refresh?: boolean | undefined;
  debug?: boolean | undefined;
  cacheDir?: string | undefined;
  agyPath?: string | undefined;
}

export interface DiscoveryResult {
  sessions: Session[];
  warnings: string[];
  totalDiscovered: number;
}

export interface SessionSource {
  discoverSessions(options: DiscoveryOptions): Promise<DiscoveryResult>;
}

export const ExitCode = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
  DATA_UNAVAILABLE: 3,
  EXECUTABLE_UNAVAILABLE: 4,
  UNSUPPORTED_STORAGE: 5,
} as const;

export type ExitCodeType = (typeof ExitCode)[keyof typeof ExitCode];

export interface DoctorCheck {
  name: string;
  status: "OK" | "WARN" | "FAIL" | "NOT FOUND";
  details: string;
  remediation?: string | undefined;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  success: boolean;
}

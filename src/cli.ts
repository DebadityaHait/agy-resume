import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import pc from "picocolors";
import type { DiscoveryOptions, JsonSession, ScopeMode, Session } from "./types.js";
import { ExitCode, AgyResumeError, InvalidArgumentError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";
import { discoverSessions } from "./discovery/discover.js";
import { runDoctor, printDoctorReport } from "./commands/doctor.js";
import { runInteractivePicker } from "./ui/picker.js";
import { launchAntigravity } from "./launch/antigravity.js";
import { normalizeWorkspacePath } from "./paths/normalize.js";

const PACKAGE_VERSION = "0.1.0";

function printSelectedSession(
  session: Session,
  extraFlags: readonly string[]
): void {
  console.log(`\nSelected conversation:`);
  console.log(`  ID:          ${pc.cyan(session.id)}`);
  console.log(`  Title:       ${session.title || "(no title)"}`);
  console.log(`  Workspace:   ${session.workspace || "(unknown)"}`);
  if (session.messageCount !== undefined && session.messageCount > 0) {
    console.log(`  Steps:       ${session.messageCount}`);
  }
  if (session.updatedAt) {
    console.log(`  Updated:     ${session.updatedAt.toISOString()}`);
  }
  if (session.firstPrompt) {
    console.log(`  Prompt:      ${session.firstPrompt}`);
  }
  if (extraFlags.length > 0) {
    console.log(`  Extra flags: ${extraFlags.join(" ")}`);
  }
  console.log("");
}

const KNOWN_AGYR_OPTIONS = new Set([
  "-v",
  "--version",
  "-a",
  "--all",
  "-s",
  "--scope",
  "--cwd",
  "--json",
  "--print-id",
  "--no-launch",
  "--refresh",
  "--no-cache",
  "--data-dir",
  "--agy-path",
  "--limit",
  "--doctor",
  "--debug",
  "-h",
  "--help",
]);

const KNOWN_AGYR_VALUE_OPTIONS = new Set([
  "-s",
  "--scope",
  "--cwd",
  "--data-dir",
  "--agy-path",
  "--limit",
]);

const AGYR_OPTION_NAMES = [
  "version",
  "all",
  "scope",
  "cwd",
  "json",
  "print-id",
  "no-launch",
  "refresh",
  "no-cache",
  "data-dir",
  "agy-path",
  "limit",
  "doctor",
  "debug",
  "help",
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost
      );
    }
  }
  return d[m]![n]!;
}

function findClosestAgyrOption(name: string): string | null {
  let minDistance = Infinity;
  let closest: string | null = null;
  for (const opt of AGYR_OPTION_NAMES) {
    const dist = levenshtein(name, opt);
    if (dist < minDistance) {
      minDistance = dist;
      closest = opt;
    }
  }
  return minDistance <= 2 ? closest : null;
}

function splitPassthroughArgs(userArgs: string[]): {
  commanderArgs: string[];
  passthroughArgs: string[];
} {
  const doubleDashIndex = userArgs.indexOf("--");
  if (doubleDashIndex !== -1) {
    return {
      commanderArgs: userArgs.slice(0, doubleDashIndex),
      passthroughArgs: userArgs.slice(doubleDashIndex + 1),
    };
  }

  // If no explicit '--' is present (e.g. PowerShell stripped '--', or user passed flags directly),
  // separate known agyr options from unrecognized flags (which are forwarded to agy).
  const commanderArgs: string[] = [];
  const passthroughArgs: string[] = [];
  let inPassthrough = false;

  for (let i = 0; i < userArgs.length; i++) {
    const arg = userArgs[i]!;

    if (inPassthrough) {
      passthroughArgs.push(arg);
      continue;
    }

    if (arg.startsWith("-")) {
      const optionName = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;

      if (KNOWN_AGYR_OPTIONS.has(optionName)) {
        commanderArgs.push(arg);
        if (
          KNOWN_AGYR_VALUE_OPTIONS.has(optionName) &&
          !arg.includes("=") &&
          i + 1 < userArgs.length &&
          !userArgs[i + 1]!.startsWith("-")
        ) {
          i++;
          commanderArgs.push(userArgs[i]!);
        }
      } else {
        // Check if it's an accidental typo of an agyr option
        const strippedName = optionName.replace(/^-+/, "");
        const closest = findClosestAgyrOption(strippedName);
        if (closest) {
          throw new InvalidArgumentError(
            `Unknown option "${arg}". Did you mean "--${closest}"?`
          );
        }

        // It is an agy passthrough flag (e.g. --dangerously-skip-permissions)
        inPassthrough = true;
        passthroughArgs.push(arg);
      }
    } else {
      commanderArgs.push(arg);
    }
  }

  return { commanderArgs, passthroughArgs };
}

export async function main(argv: string[] = process.argv): Promise<number> {
  let userArgs: string[];
  if (
    argv === process.argv ||
    (argv.length >= 2 &&
      /node(\.exe)?$/i.test(argv[0]!) &&
      /\.[cm]?[jt]s$/i.test(argv[1]!))
  ) {
    userArgs = argv.slice(2);
  } else {
    userArgs = argv;
  }

  const { commanderArgs, passthroughArgs } = splitPassthroughArgs(userArgs);

  const program = new Command();

  program
    .name("agyr")
    .description("Cross-platform workspace-scoped conversation picker for Google Antigravity CLI")
    .usage("[options] [query...] [-- <agy args...>]")
    .version(PACKAGE_VERSION, "-v, --version", "output the current version")
    .argument("[query...]", "initial search query terms")
    .option("-a, --all", "show sessions from all workspaces")
    .option("-s, --scope <scope>", "scoping mode (exact, repo, tree, all)", "exact")
    .option("--cwd <path>", "evaluate workspace scope from specific directory")
    .option("--json", "output session list as JSON")
    .option("--print-id", "output only conversation ID without launching")
    .option("--no-launch", "display selected session metadata without launching")
    .option("--refresh", "force metadata cache refresh")
    .option("--no-cache", "bypass reading and writing local cache")
    .option("--data-dir <path>", "custom Antigravity data directory")
    .option("--agy-path <path>", "custom path to Antigravity CLI executable")
    .option("--limit <number>", "limit number of sessions returned", (val) => parseInt(val, 10))
    .option("--doctor", "run diagnostic checks and exit")
    .option("--debug", "enable diagnostic debug logging")
    .helpOption("-h, --help", "display help for command");

  program.parse(commanderArgs, { from: "user" });

  const hasConversationArg = passthroughArgs.some(
    (arg) =>
      arg === "--conversation" ||
      arg.startsWith("--conversation=") ||
      arg === "-c" ||
      arg.startsWith("-c=")
  );
  if (hasConversationArg) {
    throw new InvalidArgumentError(
      "Cannot pass --conversation or -c after -- because agy-resume manages the conversation ID."
    );
  }

  const opts = program.opts();
  const queryArgs = program.args;
  const initialQuery = queryArgs.length > 0 ? queryArgs.join(" ") : undefined;

  if (opts.debug) {
    logger.setDebug(true);
  }

  // Validate scope argument
  let scope: ScopeMode = "exact";
  if (opts.all) {
    scope = "all";
  } else if (opts.scope) {
    const s = String(opts.scope).toLowerCase();
    if (s === "exact" || s === "repo" || s === "tree" || s === "all") {
      scope = s;
    } else {
      throw new InvalidArgumentError(
        `Invalid scope "${opts.scope}". Allowed values: exact, repo, tree, all`
      );
    }
  }

  const targetCwd = opts.cwd ? String(opts.cwd) : process.cwd();

  const discoveryOptions: DiscoveryOptions = {
    dataDir: opts.dataDir as string | undefined,
    cwd: targetCwd,
    scope,
    limit: opts.limit as number | undefined,
    query: initialQuery,
    noCache: Boolean(opts.cache === false),
    refresh: Boolean(opts.refresh),
    debug: Boolean(opts.debug),
    agyPath: opts.agyPath as string | undefined,
  };

  // 1. Doctor command
  if (opts.doctor) {
    const docResult = await runDoctor(discoveryOptions);
    printDoctorReport(docResult);
    return docResult.success ? ExitCode.SUCCESS : ExitCode.ERROR;
  }

  // 2. Discovery
  const discovery = await discoverSessions(discoveryOptions);

  if (opts.debug && discovery.warnings.length > 0) {
    for (const w of discovery.warnings) {
      logger.debug(w);
    }
  }

  // 3. JSON Output mode
  if (opts.json) {
    const jsonOutput: JsonSession[] = discovery.sessions.map((s) => ({
      id: s.id,
      workspace: s.workspace,
      title: s.title,
      firstPrompt: s.firstPrompt,
      createdAt: s.createdAt?.toISOString(),
      updatedAt: s.updatedAt?.toISOString(),
      messageCount: s.messageCount,
    }));
    // Must be valid pure JSON on stdout
    process.stdout.write(JSON.stringify(jsonOutput, null, 2) + "\n");
    return ExitCode.SUCCESS;
  }

  // 4. Empty State
  if (discovery.sessions.length === 0) {
    const normalizedTarget = normalizeWorkspacePath(targetCwd);
    console.log(
      `\nNo Antigravity conversations found for:\n\n  ${pc.bold(normalizedTarget)}\n\nTry:\n  ${pc.cyan("agyr --scope repo")}\n  ${pc.cyan("agyr --scope tree")}\n  ${pc.cyan("agyr --all")}\n`
    );
    return ExitCode.SUCCESS;
  }

  // 5. Non-interactive environment handling
  const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (!isTTY) {
    if (opts.printId) {
      if (discovery.sessions.length === 1) {
        process.stdout.write(discovery.sessions[0]!.id + "\n");
        return ExitCode.SUCCESS;
      }
      logger.error(
        `Multiple conversations found (${discovery.sessions.length}) in non-interactive mode.\nProvide a specific query or use --json.`
      );
      return ExitCode.ERROR;
    }

    if (opts.launch === false) {
      if (discovery.sessions.length === 1) {
        printSelectedSession(discovery.sessions[0]!, passthroughArgs);
        return ExitCode.SUCCESS;
      }
      logger.error(
        `Multiple conversations found (${discovery.sessions.length}) in non-interactive mode.\nProvide a specific query or use --json.`
      );
      return ExitCode.ERROR;
    }

    if (discovery.sessions.length === 1) {
      const selected = discovery.sessions[0]!;
      const launchWorkspace = resolveLaunchWorkspace(selected.workspace, targetCwd);
      return await launchAntigravity(selected.id, {
        cwd: launchWorkspace,
        executablePath: opts.agyPath as string | undefined,
        args: passthroughArgs,
      });
    }

    logger.error(
      `Multiple conversations found (${discovery.sessions.length}) in non-interactive mode.\nProvide a specific query or use --json.`
    );
    return ExitCode.ERROR;
  }

  // 6. Interactive Picker
  const selected = await runInteractivePicker({
    sessions: discovery.sessions,
    targetWorkspace: targetCwd,
    initialQuery,
  });

  // User cancelled (Esc or Ctrl+C)
  if (!selected) {
    return ExitCode.SUCCESS;
  }

  // 7. --print-id
  if (opts.printId) {
    process.stdout.write(selected.id + "\n");
    return ExitCode.SUCCESS;
  }

  // 8. --no-launch
  if (opts.launch === false) {
    printSelectedSession(selected, passthroughArgs);
    return ExitCode.SUCCESS;
  }

  // 9. Launch Antigravity
  const launchWorkspace = resolveLaunchWorkspace(selected.workspace, targetCwd);
  return await launchAntigravity(selected.id, {
    cwd: launchWorkspace,
    executablePath: opts.agyPath as string | undefined,
    args: passthroughArgs,
  });
}

function resolveLaunchWorkspace(selectedWorkspace?: string, fallbackCwd?: string): string {
  if (selectedWorkspace && fs.existsSync(selectedWorkspace)) {
    return selectedWorkspace;
  }
  if (fallbackCwd && fs.existsSync(fallbackCwd)) {
    return fallbackCwd;
  }
  return process.cwd();
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  try {
    const scriptPath = fs.realpathSync(process.argv[1]);
    const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));
    return scriptPath === modulePath;
  } catch {
    return (
      process.argv[1].endsWith("cli.js") ||
      process.argv[1].endsWith("cli.ts") ||
      process.argv[1].endsWith("agyr") ||
      process.argv[1].endsWith("agy-resume") ||
      process.argv[1].endsWith("agyr.cmd") ||
      process.argv[1].endsWith("agy-resume.cmd")
    );
  }
}

// Execute CLI
if (isDirectCliInvocation()) {
  main().then(
    (code) => {
      process.exit(code);
    },
    (err: unknown) => {
      if (err instanceof AgyResumeError) {
        console.error(pc.red(`\n${err.message}\n`));
        process.exit(err.exitCode);
      } else if (err instanceof Error) {
        if (logger.isDebug()) {
          console.error(err);
        } else {
          console.error(pc.red(`\nError: ${err.message}\n`));
        }
        process.exit(ExitCode.ERROR);
      } else {
        console.error(pc.red(`\nUnexpected error: ${String(err)}\n`));
        process.exit(ExitCode.ERROR);
      }
    }
  );
}

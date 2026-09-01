import { Command } from "commander";
import pc from "picocolors";
import type { DiscoveryOptions, JsonSession, ScopeMode } from "./types.js";
import { ExitCode, AgyResumeError, InvalidArgumentError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";
import { discoverSessions } from "./discovery/discover.js";
import { runDoctor, printDoctorReport } from "./commands/doctor.js";
import { runInteractivePicker } from "./ui/picker.js";
import { launchAntigravity } from "./launch/antigravity.js";
import { normalizeWorkspacePath } from "./paths/normalize.js";

const PACKAGE_VERSION = "0.1.0";

export async function main(argv: string[] = process.argv): Promise<number> {
  const program = new Command();

  program
    .name("agyr")
    .description("Cross-platform workspace-scoped conversation picker for Google Antigravity CLI")
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

  program.parse(argv);

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

    logger.error(
      "Interactive picker requires a TTY terminal.\nUse `agyr --json` to inspect conversations in automated scripts."
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
    console.log(`\nSelected conversation:`);
    console.log(`  ID:          ${pc.cyan(selected.id)}`);
    console.log(`  Title:       ${selected.title || "(no title)"}`);
    console.log(`  Workspace:   ${selected.workspace || "(unknown)"}`);
    if (selected.messageCount !== undefined && selected.messageCount > 0) {
      console.log(`  Steps:       ${selected.messageCount}`);
    }
    if (selected.updatedAt) {
      console.log(`  Updated:     ${selected.updatedAt.toISOString()}`);
    }
    if (selected.firstPrompt) {
      console.log(`  Prompt:      ${selected.firstPrompt}`);
    }
    console.log("");
    return ExitCode.SUCCESS;
  }

  // 9. Launch Antigravity
  const launchWorkspace = selected.workspace || targetCwd;
  return await launchAntigravity(selected.id, {
    cwd: launchWorkspace,
    executablePath: opts.agyPath as string | undefined,
  });
}

// Direct CLI invocation
if (process.argv[1] && (process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli.ts"))) {
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

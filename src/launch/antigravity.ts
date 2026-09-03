import fs from "node:fs";
import crossSpawn from "cross-spawn";
import { resolveAntigravityExecutable } from "./which.js";
import { AntigravityExecutableNotFoundError, InvalidArgumentError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface LaunchOptions {
  cwd: string;
  executablePath?: string | undefined;
  args?: readonly string[];
}

/**
 * Safely launches Antigravity CLI with the given conversation ID.
 * Inherits terminal stdio so the user directly interacts with Antigravity.
 */
export async function launchAntigravity(
  conversationId: string,
  options: LaunchOptions
): Promise<number> {
  const executable = resolveAntigravityExecutable(options.executablePath);

  if (!executable) {
    throw new AntigravityExecutableNotFoundError(options.executablePath);
  }

  const extraArgs = options.args ?? [];
  const hasConversationArg = extraArgs.some(
    (arg) =>
      arg === "--conversation" ||
      arg.startsWith("--conversation=") ||
      arg === "-c" ||
      arg.startsWith("-c=")
  );
  if (hasConversationArg) {
    throw new InvalidArgumentError(
      "Cannot pass --conversation or -c in args. agy-resume manages the conversation ID."
    );
  }

  const spawnCwd = fs.existsSync(options.cwd) ? options.cwd : process.cwd();
  const args = ["--conversation", conversationId, ...extraArgs];

  logger.debug(`Spawning: ${executable} ${args.join(" ")} in cwd: ${spawnCwd}`);

  return new Promise((resolve, reject) => {
    const child = crossSpawn(executable, args, {
      cwd: spawnCwd,
      stdio: "inherit",
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      resolve(code ?? 0);
    });
  });
}

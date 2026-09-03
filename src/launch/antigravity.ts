import fs from "node:fs";
import crossSpawn from "cross-spawn";
import { resolveAntigravityExecutable } from "./which.js";
import { AntigravityExecutableNotFoundError } from "../utils/errors.js";
import { validateAgyArgs } from "./arguments.js";
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
  validateAgyArgs(extraArgs);

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

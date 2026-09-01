import crossSpawn from "cross-spawn";
import { resolveAntigravityExecutable } from "./which.js";
import { AntigravityExecutableNotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface LaunchOptions {
  cwd: string;
  executablePath?: string | undefined;
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

  logger.debug(`Spawning: ${executable} --conversation ${conversationId} in cwd: ${options.cwd}`);

  const args = ["--conversation", conversationId];

  return new Promise((resolve, reject) => {
    const child = crossSpawn(executable, args, {
      cwd: options.cwd,
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

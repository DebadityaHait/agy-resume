import { InvalidArgumentError } from "../utils/errors.js";

/**
 * Splits raw user arguments at the `--agy` sentinel boundary.
 * Everything before `--agy` belongs to `agyr`.
 * Everything after `--agy` belongs to `agy`.
 */
export function splitAgyArgs(userArgs: readonly string[]): {
  agyrArgs: string[];
  agyArgs: string[];
} {
  const index = userArgs.indexOf("--agy");
  if (index === -1) {
    return {
      agyrArgs: [...userArgs],
      agyArgs: [],
    };
  }
  return {
    agyrArgs: userArgs.slice(0, index),
    agyArgs: userArgs.slice(index + 1),
  };
}

/**
 * Validates that passthrough arguments do not attempt to override
 * the conversation selection managed by agyr.
 *
 * Protects only actual agy conversation options (--conversation, --conversation=).
 * Does not invent speculative aliases.
 */
export function validateAgyArgs(args: readonly string[]): void {
  const hasConversation = args.some(
    (arg) => arg === "--conversation" || arg.startsWith("--conversation=")
  );
  if (hasConversation) {
    throw new InvalidArgumentError(
      "Cannot pass --conversation through --agy because agyr manages conversation selection."
    );
  }
}

/**
 * Tokenizes an interactive argument string into an array of arguments,
 * supporting single and double quotes for grouping arguments with spaces.
 *
 * Windows backslashes are treated literally so file paths are not corrupted.
 *
 * Limitations:
 * - Does not perform shell variable expansion ($VAR) or file globbing (*.ts).
 * - Does not evaluate shell operators (|, &&, ;, >, <).
 * - Does not invoke a shell.
 */
export function parseInteractiveAgyArgs(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const args: string[] = [];
  let current = "";
  let inToken = false;
  let inDoubleQuotes = false;
  let inSingleQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;

    if (char === '"' && !inSingleQuotes) {
      inToken = true;
      inDoubleQuotes = !inDoubleQuotes;
      continue;
    }

    if (char === "'" && !inDoubleQuotes) {
      inToken = true;
      inSingleQuotes = !inSingleQuotes;
      continue;
    }

    if (/\s/.test(char) && !inDoubleQuotes && !inSingleQuotes) {
      if (inToken) {
        args.push(current);
        current = "";
        inToken = false;
      }
      continue;
    }

    inToken = true;
    current += char;
  }

  if (inDoubleQuotes || inSingleQuotes) {
    throw new InvalidArgumentError("Unclosed quote in argument string.");
  }

  if (inToken) {
    args.push(current);
  }

  return args;
}


import readline from "node:readline";
import pc from "picocolors";
import type { Session } from "../types.js";
import { filterSessionsByQuery } from "../discovery/search.js";
import { parseInteractiveAgyArgs, validateAgyArgs } from "../launch/arguments.js";
import { renderSessionRow, truncateString } from "./format.js";

export interface PickerOptions {
  sessions: Session[];
  targetWorkspace: string;
  initialQuery?: string | undefined;
  maxVisibleItems?: number | undefined;
  columns?: number | undefined;
  input?: NodeJS.ReadableStream | undefined;
  output?: NodeJS.WritableStream | undefined;
}

export interface PickerResult {
  session: Session;
  agyArgs?: string[] | undefined;
}

/**
 * Runs the interactive conversation picker TUI.
 * Returns the selected Session with optional agy arguments,
 * or null if cancelled (Esc or Ctrl+C).
 */
export async function runInteractivePicker(
  options: PickerOptions
): Promise<PickerResult | null> {
  const { sessions, targetWorkspace } = options;
  let query = options.initialQuery || "";
  let selectedIndex = 0;
  const maxVisible = options.maxVisibleItems || 12;

  let mode: "select" | "prompt-arguments" = "select";
  let argumentInput = "";

  // Filter initially
  let filtered = filterSessionsByQuery(sessions, query);

  const input = options.input || process.stdin;
  const output = options.output || process.stdout;

  // Setup terminal
  if (!options.input) {
    const isRawSupported = Boolean((process.stdin as any).setRawMode);
    if (!isRawSupported || !process.stdin.isTTY) {
      throw new Error(
        "Interactive picker requires a TTY terminal. Use --json to list conversations in non-interactive scripts."
      );
    }
  }

  return new Promise<PickerResult | null>((resolve, reject) => {
    let renderedLineCount = 0;
    let isCleanedUp = false;

    const rl = readline.createInterface({
      input,
      escapeCodeTimeout: 50,
    });
    readline.emitKeypressEvents(input, rl);

    if (typeof (input as any).setRawMode === "function") {
      (input as any).setRawMode(true);
    }
    if (typeof (input as any).resume === "function") {
      (input as any).resume();
    }

    // Hide cursor
    output.write("\x1B[?25l");

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      // Clear rendered lines
      if (renderedLineCount > 0) {
        output.write(`\x1B[${renderedLineCount}A\x1B[0J`);
      }
      // Show cursor
      output.write("\x1B[?25h");

      input.removeListener("keypress", onKeypress);
      if (!options.output) {
        process.stdout.removeListener("resize", onResize);
      }
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
      process.removeListener("exit", onExit);

      try {
        if (typeof (input as any).setRawMode === "function") {
          (input as any).setRawMode(false);
        }
        if (typeof (input as any).pause === "function") {
          (input as any).pause();
        }
      } catch {
        // Ignore
      }
      rl.close();
    };

    const onExit = () => {
      output.write("\x1B[?25h");
    };

    const onSigint = () => {
      cleanup();
      resolve(null);
    };

    const onSigterm = () => {
      cleanup();
      resolve(null);
    };

    const onResize = () => {
      render();
    };

    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
    process.on("exit", onExit);
    if (!options.output) {
      process.stdout.on("resize", onResize);
    }

    const render = () => {
      if (isCleanedUp) return;

      // Move up and clear previous render
      if (renderedLineCount > 0) {
        output.write(`\x1B[${renderedLineCount}A\x1B[0J`);
      }

      const columns = Math.min(
        (output as any).columns || process.stdout.columns || 80,
        110
      );
      const lines: string[] = [];

      if (mode === "prompt-arguments") {
        const chosen = filtered[selectedIndex]!;
        lines.push(pc.bold(pc.cyan("  Antigravity Sessions")));
        lines.push(
          pc.dim(`  ${truncateString(targetWorkspace, Math.max(10, columns - 4))}`)
        );
        lines.push("");

        const idSuffix = ` (${chosen.id})`;
        const maxTitleWidth = Math.max(10, columns - 14 - idSuffix.length);
        const titleText = truncateString(
          chosen.title || "(no title)",
          maxTitleWidth
        );
        lines.push(`  Selected: ${pc.bold(titleText)} ${pc.dim(idSuffix)}`);
        lines.push("");

        lines.push(pc.bold("  Agy arguments:"));
        const maxInputWidth = Math.max(10, columns - 8);
        const displayInput =
          argumentInput.length > maxInputWidth
            ? argumentInput.slice(argumentInput.length - maxInputWidth)
            : argumentInput;
        lines.push(`  > ${pc.cyan(displayInput)}${pc.dim("_")}`);
        lines.push("");
        lines.push(pc.dim("  Enter confirm   Esc cancel"));

        const renderedText = lines.join("\n") + "\n";
        output.write(renderedText);
        renderedLineCount = lines.length;
        return;
      }

      // Header
      lines.push(pc.bold(pc.cyan("  Antigravity Sessions")));
      lines.push(pc.dim(`  ${targetWorkspace}`));
      lines.push("");

      // Search bar
      const searchCursor = pc.cyan("_");
      lines.push(`  Search: ${pc.bold(query)}${searchCursor}`);
      lines.push("");

      // Windowing calculations
      if (filtered.length === 0) {
        lines.push(pc.dim("  (no matching conversations)"));
        lines.push("");
      } else {
        if (selectedIndex >= filtered.length) {
          selectedIndex = Math.max(0, filtered.length - 1);
        }

        let startIdx = 0;
        if (filtered.length > maxVisible) {
          startIdx = Math.max(
            0,
            Math.min(
              selectedIndex - Math.floor(maxVisible / 2),
              filtered.length - maxVisible
            )
          );
        }
        const endIdx = Math.min(startIdx + maxVisible, filtered.length);

        for (let i = startIdx; i < endIdx; i++) {
          const session = filtered[i]!;
          const isSelected = i === selectedIndex;
          lines.push(renderSessionRow(session, isSelected, columns));
        }

        if (filtered.length > maxVisible) {
          const remainingAbove = startIdx;
          const remainingBelow = filtered.length - endIdx;
          let scrollIndicator = "";
          if (remainingAbove > 0 && remainingBelow > 0) {
            scrollIndicator = `  ↑ ${remainingAbove} more  |  ↓ ${remainingBelow} more`;
          } else if (remainingAbove > 0) {
            scrollIndicator = `  ↑ ${remainingAbove} more`;
          } else if (remainingBelow > 0) {
            scrollIndicator = `  ↓ ${remainingBelow} more`;
          }
          if (scrollIndicator) {
            lines.push(pc.dim(scrollIndicator));
          }
        }
      }

      lines.push("");
      // Summary count
      const countLabel = query.trim()
        ? `${filtered.length} matching conversation${filtered.length === 1 ? "" : "s"}`
        : `${filtered.length} conversation${filtered.length === 1 ? "" : "s"}`;
      lines.push(pc.dim(`  ${countLabel}`));
      lines.push("");

      // Shortcuts footer
      lines.push(
        pc.dim("  ↑↓ navigate   Enter resume   Tab arguments   Esc cancel")
      );

      // Render all lines
      const renderedText = lines.join("\n") + "\n";
      output.write(renderedText);
      renderedLineCount = lines.length;
    };

    // Keypress handler
    const onKeypress = (_str: string, key: readline.Key) => {
      if (!key) return;

      if (key.ctrl && key.name === "c") {
        cleanup();
        resolve(null);
        return;
      }

      if (mode === "prompt-arguments") {
        if (key.name === "escape") {
          mode = "select";
          argumentInput = "";
          render();
          return;
        }

        if (key.name === "return" || key.name === "enter") {
          const chosen = filtered[selectedIndex]!;
          try {
            const agyArgs = parseInteractiveAgyArgs(argumentInput);
            validateAgyArgs(agyArgs);
            cleanup();
            resolve({ session: chosen, agyArgs });
          } catch (err) {
            cleanup();
            reject(err);
          }
          return;
        }

        if (key.name === "backspace") {
          if (argumentInput.length > 0) {
            argumentInput = argumentInput.slice(0, -1);
            render();
          }
          return;
        }

        if (key.ctrl && key.name === "u") {
          if (argumentInput.length > 0) {
            argumentInput = "";
            render();
          }
          return;
        }

        if (key.ctrl && key.name === "w") {
          if (argumentInput.length > 0) {
            argumentInput = argumentInput.replace(/\s*\S+\s*$/, "");
            render();
          }
          return;
        }

        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
          const char = key.sequence;
          if (char >= " " && char <= "~") {
            argumentInput += char;
            render();
            return;
          }
        }

        return;
      }

      // mode === "select"
      if (key.name === "escape") {
        if (query.length > 0) {
          query = "";
          filtered = filterSessionsByQuery(sessions, query);
          selectedIndex = 0;
          render();
        } else {
          cleanup();
          resolve(null);
        }
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        if (filtered.length > 0 && filtered[selectedIndex]) {
          const chosen = filtered[selectedIndex]!;
          cleanup();
          resolve({ session: chosen });
        }
        return;
      }

      // Tab keypress -> resume with arguments prompt
      if (key.name === "tab") {
        if (filtered.length > 0 && filtered[selectedIndex]) {
          mode = "prompt-arguments";
          argumentInput = "";
          render();
        }
        return;
      }

      if (key.name === "up" || (key.ctrl && key.name === "p")) {
        if (filtered.length > 0) {
          selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
          render();
        }
        return;
      }

      if (key.name === "down" || (key.ctrl && key.name === "n")) {
        if (filtered.length > 0) {
          selectedIndex = (selectedIndex + 1) % filtered.length;
          render();
        }
        return;
      }

      if (key.name === "pageup") {
        if (filtered.length > 0) {
          selectedIndex = Math.max(0, selectedIndex - maxVisible);
          render();
        }
        return;
      }

      if (key.name === "pagedown") {
        if (filtered.length > 0) {
          selectedIndex = Math.min(filtered.length - 1, selectedIndex + maxVisible);
          render();
        }
        return;
      }

      if (key.name === "home") {
        if (filtered.length > 0) {
          selectedIndex = 0;
          render();
        }
        return;
      }

      if (key.name === "end") {
        if (filtered.length > 0) {
          selectedIndex = filtered.length - 1;
          render();
        }
        return;
      }

      // Ctrl+U: Clear search line
      if (key.ctrl && key.name === "u") {
        if (query.length > 0) {
          query = "";
          filtered = filterSessionsByQuery(sessions, query);
          selectedIndex = 0;
          render();
        }
        return;
      }

      // Ctrl+W: Delete word backward
      if (key.ctrl && key.name === "w") {
        if (query.length > 0) {
          query = query.replace(/\s*\S+\s*$/, "");
          filtered = filterSessionsByQuery(sessions, query);
          selectedIndex = 0;
          render();
        }
        return;
      }

      if (key.name === "backspace") {
        if (query.length > 0) {
          query = query.slice(0, -1);
          filtered = filterSessionsByQuery(sessions, query);
          selectedIndex = 0;
          render();
        }
        return;
      }

      // Printable character
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        const char = key.sequence;
        if (char >= " " && char <= "~") {
          query += char;
          filtered = filterSessionsByQuery(sessions, query);
          selectedIndex = 0;
          render();
          return;
        }
      }
    };

    input.on("keypress", onKeypress);

    // Initial render
    render();
  });
}

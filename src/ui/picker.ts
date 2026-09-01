import readline from "node:readline";
import pc from "picocolors";
import type { Session } from "../types.js";
import { filterSessionsByQuery } from "../discovery/search.js";
import { renderSessionRow } from "./format.js";

export interface PickerOptions {
  sessions: Session[];
  targetWorkspace: string;
  initialQuery?: string | undefined;
  maxVisibleItems?: number | undefined;
  columns?: number | undefined;
}

/**
 * Runs the interactive conversation picker TUI.
 * Returns the selected Session, or null if cancelled (Esc or Ctrl+C).
 */
export async function runInteractivePicker(options: PickerOptions): Promise<Session | null> {
  const { sessions, targetWorkspace } = options;
  let query = options.initialQuery || "";
  let selectedIndex = 0;
  const maxVisible = options.maxVisibleItems || 12;

  // Filter initially
  let filtered = filterSessionsByQuery(sessions, query);

  // Setup terminal
  const isRawSupported = Boolean(process.stdin.setRawMode);
  if (!isRawSupported || !process.stdin.isTTY) {
    throw new Error(
      "Interactive picker requires a TTY terminal. Use --json to list conversations in non-interactive scripts."
    );
  }

  return new Promise<Session | null>((resolve) => {
    let renderedLineCount = 0;
    const rl = readline.createInterface({
      input: process.stdin,
      escapeCodeTimeout: 50,
    });
    readline.emitKeypressEvents(process.stdin, rl);

    process.stdin.setRawMode?.(true);
    process.stdin.resume();

    // Hide cursor
    process.stdout.write("\x1B[?25l");

    const cleanup = () => {
      // Clear rendered lines
      if (renderedLineCount > 0) {
        process.stdout.write(`\x1B[${renderedLineCount}A\x1B[0J`);
      }
      // Show cursor
      process.stdout.write("\x1B[?25h");
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      rl.close();
    };

    const render = () => {
      // Move up and clear previous render
      if (renderedLineCount > 0) {
        process.stdout.write(`\x1B[${renderedLineCount}A\x1B[0J`);
      }

      const columns = Math.min(process.stdout.columns || 80, 100);
      const lines: string[] = [];

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
          startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), filtered.length - maxVisible));
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
        pc.dim("  ↑↓ navigate   type search   enter resume   esc quit")
      );

      // Render all lines
      const output = lines.join("\n") + "\n";
      process.stdout.write(output);
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

      if (key.name === "escape") {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        if (filtered.length > 0 && filtered[selectedIndex]) {
          const chosen = filtered[selectedIndex]!;
          cleanup();
          resolve(chosen);
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

    process.stdin.on("keypress", onKeypress);

    // Initial render
    render();
  });
}

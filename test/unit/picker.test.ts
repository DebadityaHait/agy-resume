import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import type readline from "node:readline";
import { describe, it, expect } from "vitest";
import { runInteractivePicker } from "../../src/ui/picker.js";
import type { Session } from "../../src/types.js";
import { InvalidArgumentError } from "../../src/utils/errors.js";

const mockSessions: Session[] = [
  {
    id: "session-1",
    workspace: "C:\\work\\node",
    title: "First Unit",
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T12:00:00Z"),
  },
  {
    id: "session-2",
    workspace: "C:\\work\\node",
    title: "Second Unit",
    createdAt: new Date("2026-09-02T10:00:00Z"),
    updatedAt: new Date("2026-09-02T12:00:00Z"),
  },
  {
    id: "session-3",
    workspace: "C:\\work\\node",
    title: "Alpha Task",
    createdAt: new Date("2026-09-03T10:00:00Z"),
    updatedAt: new Date("2026-09-03T12:00:00Z"),
  },
];

function createMockIO() {
  const input = new EventEmitter() as any;
  input.setRawMode = () => {};
  input.resume = () => {};
  input.pause = () => {};

  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  }) as any;
  output.columns = 80;

  return { input, output };
}

function sendKey(input: any, str: string, key: Partial<readline.Key>) {
  input.emit("keypress", str, {
    sequence: str,
    name: undefined,
    ctrl: false,
    meta: false,
    shift: false,
    ...key,
  });
}

function typeString(input: any, text: string) {
  for (const ch of text) {
    sendKey(input, ch, { sequence: ch });
  }
}

describe("runInteractivePicker", () => {
  it("Enter resumes normally and does not open the argument prompt", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Press Enter immediately
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result).not.toBeNull();
    expect(result?.session.id).toBe("session-1");
    // Verifies arguments prompt was never opened
    expect(result?.agyArgs).toBeUndefined();
  });

  it("normal selector navigation (Up/Down) remains unchanged", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Navigate down to second session
    sendKey(input, "", { name: "down" });
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-2");
    expect(result?.agyArgs).toBeUndefined();
  });

  it("Tab opens the arguments prompt, accepts input, and Enter launches with agyArgs", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Press Tab to open arguments prompt
    sendKey(input, "\t", { name: "tab" });
    typeString(input, "--model flash");
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-1");
    expect(result?.agyArgs).toEqual(["--model", "flash"]);
  });

  it("empty Tab prompt input launches normally with empty agyArgs", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Open arguments prompt with Tab
    sendKey(input, "\t", { name: "tab" });

    // Submit empty prompt with Enter
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-1");
    expect(result?.agyArgs).toEqual([]);
  });

  it("whitespace-only Tab prompt input launches normally with empty agyArgs", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Open arguments prompt with Tab
    sendKey(input, "\t", { name: "tab" });
    typeString(input, "   ");

    // Submit prompt with Enter
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-1");
    expect(result?.agyArgs).toEqual([]);
  });

  it("cancelling the arguments prompt with Esc returns safely to selector without launching", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Open arguments prompt with Tab
    sendKey(input, "\t", { name: "tab" });
    typeString(input, "--model flash");

    // Cancel the prompt with Escape -> should return to select mode
    sendKey(input, "", { name: "escape" });

    // Press Escape again in select mode -> should cancel the picker entirely
    sendKey(input, "", { name: "escape" });

    const result = await promise;
    expect(result).toBeNull();
  });

  it("cancelling prompt with Esc returns to selector and then Enter resumes normally", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Open prompt with Tab
    sendKey(input, "\t", { name: "tab" });
    typeString(input, "--model flash");

    // Cancel prompt with Esc
    sendKey(input, "", { name: "escape" });

    // Press Enter in selector to resume normally
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-1");
    expect(result?.agyArgs).toBeUndefined();
  });

  it("lowercase 'a' remains normal search input and does not open arguments prompt", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Type lowercase 'a' - should filter to "Alpha Task" (session-3)
    // Neither "First Unit" nor "Second Unit" contains 'a'
    sendKey(input, "a", { sequence: "a" });
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-3");
    expect(result?.agyArgs).toBeUndefined();
  });

  it("uppercase 'A' remains normal search input rather than triggering an action", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Type uppercase 'A' (e.g. Shift+A) - should filter to "Alpha Task" (session-3)
    // It must NOT open the arguments prompt
    sendKey(input, "A", { sequence: "A", name: "a", shift: true });
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-3");
    expect(result?.agyArgs).toBeUndefined();
  });

  it("normal case-insensitive search behavior is identical for 'a' and 'A'", async () => {
    // 1. Lowercase search
    const { input: inLower, output: outLower } = createMockIO();
    const pLower = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input: inLower,
      output: outLower,
    });
    typeString(inLower, "alpha");
    sendKey(inLower, "\r", { name: "return" });
    const resLower = await pLower;

    // 2. Uppercase search
    const { input: inUpper, output: outUpper } = createMockIO();
    const pUpper = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input: inUpper,
      output: outUpper,
    });
    typeString(inUpper, "ALPHA");
    sendKey(inUpper, "\r", { name: "return" });
    const resUpper = await pUpper;

    expect(resLower?.session.id).toBe("session-3");
    expect(resUpper?.session.id).toBe("session-3");
  });

  it("Tab behavior does not interfere with existing navigation and search", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Type search query matching session-1 and session-2
    typeString(input, "Unit");
    // Navigate to second match
    sendKey(input, "", { name: "down" });
    // Open Tab arguments prompt on the navigated match
    sendKey(input, "\t", { name: "tab" });
    typeString(input, "--dangerously-skip-permissions");
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-2");
    expect(result?.agyArgs).toEqual(["--dangerously-skip-permissions"]);
  });

  it("Tab is ignored and does not open argument prompt when no conversations match", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    // Type query matching nothing
    typeString(input, "nonexistent");
    // Press Tab - should do nothing because filtered.length === 0
    sendKey(input, "\t", { name: "tab" });
    // Press Escape to clear search query
    sendKey(input, "", { name: "escape" });
    // Press Enter to resume first session normally
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-1");
    expect(result?.agyArgs).toBeUndefined();
  });

  it("--dangerously-skip-permissions becomes one forwarded argv entry", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    sendKey(input, "\t", { name: "tab" });
    typeString(input, "--dangerously-skip-permissions");
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.session.id).toBe("session-1");
    expect(result?.agyArgs).toEqual(["--dangerously-skip-permissions"]);
  });

  it("quoted values with spaces remain one argv entry (double quotes)", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    sendKey(input, "\t", { name: "tab" });
    typeString(input, '--foo "value with spaces" --model flash');
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.agyArgs).toEqual([
      "--foo",
      "value with spaces",
      "--model",
      "flash",
    ]);
  });

  it("single-quoted values with spaces remain one argv entry", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    sendKey(input, "\t", { name: "tab" });
    typeString(input, "--foo 'value with spaces'");
    sendKey(input, "\r", { name: "return" });

    const result = await promise;
    expect(result?.agyArgs).toEqual(["--foo", "value with spaces"]);
  });

  it("protected conversation arguments are rejected", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    sendKey(input, "\t", { name: "tab" });
    typeString(input, "--conversation other-id");
    sendKey(input, "\r", { name: "return" });

    await expect(promise).rejects.toThrow(InvalidArgumentError);
    await expect(promise).rejects.toThrow(
      "Cannot pass --conversation through --agy because agyr manages conversation selection."
    );
  });

  it("unclosed quotes in arguments prompt reject cleanly", async () => {
    const { input, output } = createMockIO();

    const promise = runInteractivePicker({
      sessions: mockSessions,
      targetWorkspace: "C:\\Projects\\app",
      input,
      output,
    });

    sendKey(input, "\t", { name: "tab" });
    typeString(input, '--foo "unclosed');
    sendKey(input, "\r", { name: "return" });

    await expect(promise).rejects.toThrow(InvalidArgumentError);
    await expect(promise).rejects.toThrow("Unclosed quote in argument string.");
  });
});


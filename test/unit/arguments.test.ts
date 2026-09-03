import { describe, it, expect } from "vitest";
import {
  splitAgyArgs,
  validateAgyArgs,
  parseInteractiveAgyArgs,
} from "../../src/launch/arguments.js";
import { InvalidArgumentError } from "../../src/utils/errors.js";

describe("splitAgyArgs", () => {
  it("splits arguments before and after --agy boundary", () => {
    const res = splitAgyArgs(["auth", "--agy", "--dangerously-skip-permissions"]);
    expect(res.agyrArgs).toEqual(["auth"]);
    expect(res.agyArgs).toEqual(["--dangerously-skip-permissions"]);
  });

  it("handles multiple passthrough arguments after --agy", () => {
    const res = splitAgyArgs([
      "auth",
      "--scope",
      "repo",
      "--agy",
      "--model",
      "flash",
      "--dangerously-skip-permissions",
    ]);
    expect(res.agyrArgs).toEqual(["auth", "--scope", "repo"]);
    expect(res.agyArgs).toEqual([
      "--model",
      "flash",
      "--dangerously-skip-permissions",
    ]);
  });

  it("keeps shared option names unambiguous across the boundary", () => {
    const res = splitAgyArgs(["--debug", "auth", "--agy", "--debug"]);
    expect(res.agyrArgs).toEqual(["--debug", "auth"]);
    expect(res.agyArgs).toEqual(["--debug"]);
  });

  it("returns all arguments for agyr and empty agyArgs when no --agy present", () => {
    const res = splitAgyArgs(["auth", "--scope", "repo", "token"]);
    expect(res.agyrArgs).toEqual(["auth", "--scope", "repo", "token"]);
    expect(res.agyArgs).toEqual([]);
  });

  it("returns empty agyArgs when --agy is at the very end", () => {
    const res = splitAgyArgs(["auth", "--agy"]);
    expect(res.agyrArgs).toEqual(["auth"]);
    expect(res.agyArgs).toEqual([]);
  });

  it("splits correctly when --agy is the first argument", () => {
    const res = splitAgyArgs(["--agy", "--model", "flash"]);
    expect(res.agyrArgs).toEqual([]);
    expect(res.agyArgs).toEqual(["--model", "flash"]);
  });

  it("splits at the first --agy sentinel if multiple are present", () => {
    const res = splitAgyArgs(["auth", "--agy", "--model", "flash", "--agy", "extra"]);
    expect(res.agyrArgs).toEqual(["auth"]);
    expect(res.agyArgs).toEqual(["--model", "flash", "--agy", "extra"]);
  });
});

describe("validateAgyArgs", () => {
  it("passes when valid agy arguments are provided", () => {
    expect(() =>
      validateAgyArgs(["--model", "flash", "--dangerously-skip-permissions", "-c"])
    ).not.toThrow();
  });

  it("passes for empty arguments", () => {
    expect(() => validateAgyArgs([])).not.toThrow();
  });

  it("rejects --conversation in arguments", () => {
    expect(() => validateAgyArgs(["--conversation", "other-id"])).toThrow(
      InvalidArgumentError
    );
    expect(() => validateAgyArgs(["--conversation", "other-id"])).toThrow(
      "Cannot pass --conversation through --agy because agyr manages conversation selection."
    );
  });

  it("rejects --conversation=id in arguments", () => {
    expect(() => validateAgyArgs(["--conversation=other-id"])).toThrow(
      InvalidArgumentError
    );
    expect(() => validateAgyArgs(["--conversation=other-id"])).toThrow(
      "Cannot pass --conversation through --agy because agyr manages conversation selection."
    );
  });

  it("does not reject speculative -conversation because agy only defines --conversation", () => {
    expect(() => validateAgyArgs(["-conversation", "other-id"])).not.toThrow();
    expect(() => validateAgyArgs(["-conversation=other-id"])).not.toThrow();
  });

  it("does not reject -c because it is --continue in agy", () => {
    expect(() => validateAgyArgs(["-c"])).not.toThrow();
    expect(() => validateAgyArgs(["-c", "something"])).not.toThrow();
  });
});

describe("parseInteractiveAgyArgs", () => {
  it("returns empty array for empty or whitespace-only input", () => {
    expect(parseInteractiveAgyArgs("")).toEqual([]);
    expect(parseInteractiveAgyArgs("   ")).toEqual([]);
    expect(parseInteractiveAgyArgs("\t\n")).toEqual([]);
  });

  it("tokenizes a single flag", () => {
    expect(parseInteractiveAgyArgs("--dangerously-skip-permissions")).toEqual([
      "--dangerously-skip-permissions",
    ]);
  });

  it("tokenizes flag with value", () => {
    expect(parseInteractiveAgyArgs("--model flash")).toEqual([
      "--model",
      "flash",
    ]);
  });

  it("tokenizes multiple flags and options", () => {
    expect(
      parseInteractiveAgyArgs("--model flash --dangerously-skip-permissions")
    ).toEqual(["--model", "flash", "--dangerously-skip-permissions"]);
  });

  it("preserves double-quoted values with spaces as a single argument", () => {
    expect(parseInteractiveAgyArgs('--foo "value with spaces"')).toEqual([
      "--foo",
      "value with spaces",
    ]);
  });

  it("preserves single-quoted values with spaces as a single argument", () => {
    expect(parseInteractiveAgyArgs("--foo 'value with spaces'")).toEqual([
      "--foo",
      "value with spaces",
    ]);
  });

  it("handles mixed quotes and options", () => {
    expect(
      parseInteractiveAgyArgs(
        '--model flash --prompt "Hello World" --flag \'single value\''
      )
    ).toEqual([
      "--model",
      "flash",
      "--prompt",
      "Hello World",
      "--flag",
      "single value",
    ]);
  });

  it("handles --option=\"value with spaces\"", () => {
    expect(parseInteractiveAgyArgs('--option="value with spaces"')).toEqual([
      "--option=value with spaces",
    ]);
  });

  it("handles Windows backslashes in paths literally without corruption", () => {
    // Unquoted Windows path
    expect(
      parseInteractiveAgyArgs("--add-dir C:\\Users\\deba\\project")
    ).toEqual(["--add-dir", "C:\\Users\\deba\\project"]);

    // Quoted Windows path with spaces
    expect(
      parseInteractiveAgyArgs('--add-dir "C:\\Program Files\\project"')
    ).toEqual(["--add-dir", "C:\\Program Files\\project"]);

    // Windows path with multiple directories
    expect(
      parseInteractiveAgyArgs("--foo D:\\k0de2\\agyr")
    ).toEqual(["--foo", "D:\\k0de2\\agyr"]);

    // Quoted Windows path with trailing backslash (must not escape closing quote)
    expect(
      parseInteractiveAgyArgs('--dir "C:\\Users\\deba\\project\\"')
    ).toEqual(["--dir", "C:\\Users\\deba\\project\\"]);

    // Windows UNC path
    expect(
      parseInteractiveAgyArgs("--server \\\\server\\share\\repo")
    ).toEqual(["--server", "\\\\server\\share\\repo"]);

    // Windows paths containing characters that resemble escape sequences (\t, \n, \r, \b)
    expect(
      parseInteractiveAgyArgs("--path C:\\tools\\new\\reports\\bin")
    ).toEqual(["--path", "C:\\tools\\new\\reports\\bin"]);

    // Option with equals sign and quoted Windows path
    expect(
      parseInteractiveAgyArgs('--add-dir="C:\\Program Files\\project"')
    ).toEqual(["--add-dir=C:\\Program Files\\project"]);
  });

  it("handles quotes enclosing quotes of the other type", () => {
    expect(
      parseInteractiveAgyArgs('--prompt "hello \'world\'"')
    ).toEqual(["--prompt", "hello 'world'"]);

    expect(
      parseInteractiveAgyArgs("--prompt 'hello \"world\"'")
    ).toEqual(["--prompt", 'hello "world"']);
  });

  it("preserves empty double-quoted argument as empty string", () => {
    expect(parseInteractiveAgyArgs('--message ""')).toEqual(["--message", ""]);
    expect(parseInteractiveAgyArgs('""')).toEqual([""]);
  });

  it("preserves empty single-quoted argument as empty string", () => {
    expect(parseInteractiveAgyArgs("--message ''")).toEqual(["--message", ""]);
    expect(parseInteractiveAgyArgs("''")).toEqual([""]);
  });

  it("preserves multiple empty and non-empty tokens in sequence", () => {
    expect(parseInteractiveAgyArgs('"" ""')).toEqual(["", ""]);
    expect(
      parseInteractiveAgyArgs('--foo "" --bar "val" --baz \'\'')
    ).toEqual(["--foo", "", "--bar", "val", "--baz", ""]);
  });

  it("throws InvalidArgumentError on unclosed double quote", () => {
    expect(() => parseInteractiveAgyArgs('--foo "unclosed string')).toThrow(
      InvalidArgumentError
    );
    expect(() => parseInteractiveAgyArgs('--foo "unclosed string')).toThrow(
      "Unclosed quote in argument string."
    );
  });

  it("throws InvalidArgumentError on unclosed single quote", () => {
    expect(() => parseInteractiveAgyArgs("--foo 'unclosed string")).toThrow(
      InvalidArgumentError
    );
    expect(() => parseInteractiveAgyArgs("--foo 'unclosed string")).toThrow(
      "Unclosed quote in argument string."
    );
  });
});

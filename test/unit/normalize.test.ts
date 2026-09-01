import { describe, it, expect } from "vitest";
import {
  normalizeWorkspacePath,
  areWorkspacesEqual,
  isSubdirectoryOf,
} from "../../src/paths/normalize.js";

describe("normalizeWorkspacePath", () => {
  describe("Windows paths (win32)", () => {
    const opts = { platform: "win32" as const };

    it("handles lowercase drive letters", () => {
      expect(normalizeWorkspacePath("c:\\projects\\app", opts)).toBe("C:\\projects\\app");
      expect(normalizeWorkspacePath("d:\\my-code", opts)).toBe("D:\\my-code");
    });

    it("handles forward slashes on Windows", () => {
      expect(normalizeWorkspacePath("C:/projects/app", opts)).toBe("C:\\projects\\app");
      expect(normalizeWorkspacePath("c:/users/user/projects/auth-service", opts)).toBe(
        "C:\\users\\user\\projects\\auth-service"
      );
    });

    it("strips trailing backslashes while preserving root drive", () => {
      expect(normalizeWorkspacePath("C:\\projects\\app\\", opts)).toBe("C:\\projects\\app");
      expect(normalizeWorkspacePath("C:\\", opts)).toBe("C:\\");
      expect(normalizeWorkspacePath("c:/", opts)).toBe("C:\\");
    });

    it("resolves relative path components (. and ..)", () => {
      expect(normalizeWorkspacePath("C:\\projects\\foo\\..\\app", opts)).toBe(
        "C:\\projects\\app"
      );
      expect(normalizeWorkspacePath("C:\\projects\\.\\app", opts)).toBe("C:\\projects\\app");
    });

    it("handles UNC paths", () => {
      expect(normalizeWorkspacePath("\\\\server\\share\\project", opts)).toBe(
        "\\\\server\\share\\project"
      );
      expect(normalizeWorkspacePath("\\\\SERVER\\share\\project\\", opts)).toBe(
        "\\\\SERVER\\share\\project"
      );
    });

    it("handles file:// URIs on Windows", () => {
      expect(normalizeWorkspacePath("file:///C:/Projects/auth-service", opts)).toBe(
        "C:\\Projects\\auth-service"
      );
      expect(normalizeWorkspacePath("file:///c%3A/Projects/auth-service", opts)).toBe(
        "C:\\Projects\\auth-service"
      );
      expect(normalizeWorkspacePath("file:///c:/Users/user/My%20Project", opts)).toBe(
        "C:\\Users\\user\\My Project"
      );
    });

    it("handles paths with spaces and Unicode", () => {
      expect(normalizeWorkspacePath("C:\\Users\\user\\My Projects\\app 🚀", opts)).toBe(
        "C:\\Users\\user\\My Projects\\app 🚀"
      );
    });
  });

  describe("POSIX paths (linux / darwin)", () => {
    const opts = { platform: "linux" as const };

    it("normalizes POSIX slashes and preserves case", () => {
      expect(normalizeWorkspacePath("/home/user/App", opts)).toBe("/home/user/App");
      expect(normalizeWorkspacePath("/home/user/app", opts)).toBe("/home/user/app");
    });

    it("resolves . and .. on POSIX", () => {
      expect(normalizeWorkspacePath("/home/user/foo/../app", opts)).toBe("/home/user/app");
      expect(normalizeWorkspacePath("/home/user/./app", opts)).toBe("/home/user/app");
    });

    it("strips trailing slashes while preserving root /", () => {
      expect(normalizeWorkspacePath("/home/user/app/", opts)).toBe("/home/user/app");
      expect(normalizeWorkspacePath("/", opts)).toBe("/");
    });

    it("handles file:// URIs on POSIX", () => {
      expect(normalizeWorkspacePath("file:///home/user/project", opts)).toBe(
        "/home/user/project"
      );
      expect(normalizeWorkspacePath("file:///home/user/My%20Project", opts)).toBe(
        "/home/user/My Project"
      );
    });
  });
});

describe("areWorkspacesEqual", () => {
  it("evaluates Windows paths case-insensitively and slash-agnostically", () => {
    expect(
      areWorkspacesEqual("C:\\Users\\User\\Project", "c:\\users\\user\\project", "win32")
    ).toBe(true);
    expect(
      areWorkspacesEqual("C:/Users/User/Project", "C:\\Users\\User\\Project\\", "win32")
    ).toBe(true);
    expect(
      areWorkspacesEqual(
        "file:///c:/Users/User/Project",
        "C:\\Users\\User\\Project",
        "win32"
      )
    ).toBe(true);
    expect(
      areWorkspacesEqual("C:\\Projects\\app", "D:\\Projects\\app", "win32")
    ).toBe(false);
  });

  it("evaluates POSIX paths with case sensitivity", () => {
    expect(
      areWorkspacesEqual("/home/user/app", "/home/user/app", "linux")
    ).toBe(true);
    expect(
      areWorkspacesEqual("/home/user/App", "/home/user/app", "linux")
    ).toBe(false);
    expect(
      areWorkspacesEqual("/home/user/app/", "/home/user/app", "linux")
    ).toBe(true);
  });
});

describe("isSubdirectoryOf", () => {
  it("correctly identifies subdirectories and avoids prefix traps", () => {
    // True subdirectories
    expect(isSubdirectoryOf("/project/app", "/project/app/subdir", "linux")).toBe(true);
    expect(isSubdirectoryOf("/project/app", "/project/app/sub/deeper", "linux")).toBe(true);

    // Prefix traps: must NOT match
    expect(isSubdirectoryOf("/project/app", "/project/application", "linux")).toBe(false);
    expect(isSubdirectoryOf("/project/app", "/project/app-other", "linux")).toBe(false);
    expect(isSubdirectoryOf("/project/app", "/project/app", "linux")).toBe(false); // same dir is not subdirectory

    // Windows subdirectories
    expect(
      isSubdirectoryOf("C:\\Projects\\app", "c:\\projects\\app\\subdir", "win32")
    ).toBe(true);
    expect(
      isSubdirectoryOf("C:\\Projects\\app", "C:\\Projects\\application", "win32")
    ).toBe(false);
    expect(
      isSubdirectoryOf("C:\\Projects\\app", "D:\\Projects\\app\\subdir", "win32")
    ).toBe(false);
  });
});

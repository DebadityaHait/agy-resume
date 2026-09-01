import { ExitCode, type ExitCodeType } from "../types.js";

export { ExitCode, type ExitCodeType };

export class AgyResumeError extends Error {
  readonly exitCode: ExitCodeType;

  constructor(message: string, exitCode: ExitCodeType = ExitCode.ERROR) {
    super(message);
    this.name = "AgyResumeError";
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidArgumentError extends AgyResumeError {
  constructor(message: string) {
    super(message, ExitCode.INVALID_ARGS);
    this.name = "InvalidArgumentError";
  }
}

export class AntigravityDataNotFoundError extends AgyResumeError {
  constructor(dataDir: string, details?: string) {
    const msg = details
      ? `Antigravity data not found at ${dataDir}: ${details}`
      : `Antigravity data directory not found at: ${dataDir}\n\nPlease verify that Antigravity CLI has been run at least once, or specify --data-dir.`;
    super(msg, ExitCode.DATA_UNAVAILABLE);
    this.name = "AntigravityDataNotFoundError";
  }
}

export class AntigravityExecutableNotFoundError extends AgyResumeError {
  constructor(customPath?: string) {
    const msg = customPath
      ? `Antigravity CLI executable not found at: ${customPath}`
      : `Could not locate \`agy\` on PATH.\n\nInstall Antigravity CLI or specify the binary with --agy-path.`;
    super(msg, ExitCode.EXECUTABLE_UNAVAILABLE);
    this.name = "AntigravityExecutableNotFoundError";
  }
}

export class UnsupportedStorageFormatError extends AgyResumeError {
  constructor(details: string) {
    const msg = `agy-resume could not recognize the current Antigravity session metadata format.\n\n${details}\n\nRun \`agyr --doctor --debug\` for details.\nagy-resume did not modify any Antigravity files.`;
    super(msg, ExitCode.UNSUPPORTED_STORAGE);
    this.name = "UnsupportedStorageFormatError";
  }
}

export class NotInGitRepositoryError extends AgyResumeError {
  constructor(cwd: string) {
    super(
      `Current directory is not inside a Git repository:\n  ${cwd}\n\nTry running with:\n  agyr --scope exact\n  agyr --scope tree\n  agyr --all`,
      ExitCode.INVALID_ARGS
    );
    this.name = "NotInGitRepositoryError";
  }
}

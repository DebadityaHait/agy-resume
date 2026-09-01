import pc from "picocolors";

export class Logger {
  private debugMode: boolean;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  setDebug(enabled: boolean): void {
    this.debugMode = enabled;
  }

  isDebug(): boolean {
    return this.debugMode;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.debugMode) {
      const prefix = pc.dim("[debug]");
      if (args.length > 0) {
        console.error(prefix, message, ...args);
      } else {
        console.error(prefix, message);
      }
    }
  }

  warn(message: string, ...args: unknown[]): void {
    const prefix = pc.yellow("warn:");
    if (args.length > 0) {
      console.error(prefix, message, ...args);
    } else {
      console.error(prefix, message);
    }
  }

  error(message: string, ...args: unknown[]): void {
    const prefix = pc.red("error:");
    if (args.length > 0) {
      console.error(prefix, message, ...args);
    } else {
      console.error(prefix, message);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      console.error(message, ...args);
    } else {
      console.error(message);
    }
  }
}

export const logger = new Logger(false);

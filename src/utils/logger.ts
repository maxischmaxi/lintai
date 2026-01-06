export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = "info";
  private isLSP = false;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setLSPMode(isLSP: boolean): void {
    this.isLSP = isLSP;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const formattedArgs = args.length > 0 ? " " + JSON.stringify(args) : "";
    return `${prefix} ${message}${formattedArgs}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      // In LSP mode, write to stderr to avoid interfering with protocol
      const output = this.format("debug", message, ...args);
      if (this.isLSP) {
        process.stderr.write(output + "\n");
      } else {
        console.debug(output);
      }
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      const output = this.format("info", message, ...args);
      if (this.isLSP) {
        process.stderr.write(output + "\n");
      } else {
        console.info(output);
      }
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      const output = this.format("warn", message, ...args);
      if (this.isLSP) {
        process.stderr.write(output + "\n");
      } else {
        console.warn(output);
      }
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      const output = this.format("error", message, ...args);
      if (this.isLSP) {
        process.stderr.write(output + "\n");
      } else {
        console.error(output);
      }
    }
  }
}

export const logger = new Logger();

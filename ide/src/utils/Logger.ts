import { EventEmitter } from 'events';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Logger utility for Kimi IDE IDE
 */
export class Logger extends EventEmitter {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;
  private prefix: string = '[Kimi IDE]';

  private constructor() {
    super();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set log level
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get log level
   */
  public getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set prefix
   */
  public setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  /**
   * Format message
   */
  private format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} ${this.prefix} [${level}] ${message}`;
  }

  /**
   * Log debug message
   */
  public debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const formatted = this.format('DEBUG', message);
      console.debug(formatted, ...args);
      this.emit('log', { level: LogLevel.DEBUG, message, args });
    }
  }

  /**
   * Log info message
   */
  public info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      const formatted = this.format('INFO', message);
      console.info(formatted, ...args);
      this.emit('log', { level: LogLevel.INFO, message, args });
    }
  }

  /**
   * Log warning message
   */
  public warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      const formatted = this.format('WARN', message);
      console.warn(formatted, ...args);
      this.emit('log', { level: LogLevel.WARN, message, args });
    }
  }

  /**
   * Log error message
   */
  public error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      const formatted = this.format('ERROR', message);
      console.error(formatted, ...args);
      this.emit('log', { level: LogLevel.ERROR, message, args });
      this.emit('error', { message, args });
    }
  }
}

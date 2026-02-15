/**
 * Logger utility for Kimi IDE extension
 * Provides OutputChannel logging and file logging capabilities
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const EXTENSION_NAME = 'Kimi';
const LOG_OUTPUT_CHANNEL = vscode.window.createOutputChannel(EXTENSION_NAME);

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

interface LoggerConfig {
    logLevel: LogLevel;
    logToFile: boolean;
    logFilePath?: string;
    maxLogFileSize?: number; // in bytes
    maxLogFiles?: number;
}

export class Logger {
    private config: LoggerConfig;
    private logFileStream: fs.WriteStream | null = null;

    constructor() {
        this.config = {
            logLevel: LogLevel.INFO,
            logToFile: false,
            maxLogFileSize: 5 * 1024 * 1024, // 5MB
            maxLogFiles: 3,
        };
        this.loadConfig();
    }

    private loadConfig(): void {
        const config = vscode.workspace.getConfiguration('kimi');
        this.config.logLevel = this.parseLogLevel(config.get<string>('logLevel', 'info'));
        this.config.logToFile = config.get<boolean>('logToFile', false);
        
        if (this.config.logToFile) {
            this.initializeLogFile();
        }
    }

    private parseLogLevel(level: string): LogLevel {
        switch (level.toLowerCase()) {
            case 'debug': return LogLevel.DEBUG;
            case 'warn':
            case 'warning': return LogLevel.WARN;
            case 'error': return LogLevel.ERROR;
            default: return LogLevel.INFO;
        }
    }

    private initializeLogFile(): void {
        if (!this.config.logToFile) return;

        try {
            const logUri = (vscode.env as any).logUri;
            const logDir = this.config.logFilePath || path.join(
                logUri?.fsPath || path.join(require('os').tmpdir(), 'kimi-logs')
            );
            
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const logFilePath = path.join(logDir, 'kimi.log');
            this.rotateLogFiles(logFilePath);
            
            this.logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
        } catch (error) {
            this.error('Failed to initialize log file:', error);
        }
    }

    private rotateLogFiles(logFilePath: string): void {
        const maxFiles = this.config.maxLogFiles || 3;
        
        for (let i = maxFiles - 1; i > 0; i--) {
            const oldPath = `${logFilePath}.${i}`;
            const newPath = `${logFilePath}.${i + 1}`;
            
            if (fs.existsSync(oldPath)) {
                if (i === maxFiles - 1) {
                    fs.unlinkSync(oldPath);
                } else {
                    fs.renameSync(oldPath, newPath);
                }
            }
        }
        
        if (fs.existsSync(logFilePath)) {
            const stats = fs.statSync(logFilePath);
            if (stats.size >= (this.config.maxLogFileSize || 5 * 1024 * 1024)) {
                fs.renameSync(logFilePath, `${logFilePath}.1`);
            }
        }
    }

    private formatMessage(level: string, message: string, ...args: unknown[]): string {
        const timestamp = new Date().toISOString();
        const argsStr = args.length > 0 ? ' ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ') : '';
        return `[${timestamp}] [${level}] ${message}${argsStr}`;
    }

    private log(level: LogLevel, levelName: string, message: string, ...args: unknown[]): void {
        if (level < this.config.logLevel) return;

        const formattedMessage = this.formatMessage(levelName, message, ...args);
        
        // Log to output channel
        LOG_OUTPUT_CHANNEL.appendLine(formattedMessage);

        // Log to file
        if (this.config.logToFile && this.logFileStream) {
            this.logFileStream.write(formattedMessage + '\n');
        }

        // Also log to console in debug mode
        if (this.config.logLevel === LogLevel.DEBUG) {
            console.log(`[Kimi] ${formattedMessage}`);
        }
    }

    debug(message: string, ...args: unknown[]): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
    }

    info(message: string, ...args: unknown[]): void {
        this.log(LogLevel.INFO, 'INFO', message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this.log(LogLevel.WARN, 'WARN', message, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        this.log(LogLevel.ERROR, 'ERROR', message, ...args);
    }

    showOutputChannel(): void {
        LOG_OUTPUT_CHANNEL.show();
    }

    setLogLevel(level: LogLevel): void {
        this.config.logLevel = level;
    }

    isDebugMode(): boolean {
        return this.config.logLevel === LogLevel.DEBUG;
    }

    dispose(): void {
        if (this.logFileStream) {
            this.logFileStream.end();
            this.logFileStream = null;
        }
        LOG_OUTPUT_CHANNEL.dispose();
    }
}

export const logger = new Logger();

// Utility functions
export function logError(error: unknown, context?: string): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    if (context) {
        logger.error(`${context}: ${message}`);
    } else {
        logger.error(message);
    }
    
    if (stack && logger.isDebugMode()) {
        logger.debug('Stack trace:', stack);
    }
}

export function logDuration<T>(operation: string, fn: () => T): T {
    const start = Date.now();
    try {
        return fn();
    } finally {
        const duration = Date.now() - start;
        logger.debug(`${operation} took ${duration}ms`);
    }
}

export async function logDurationAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
        return await fn();
    } finally {
        const duration = Date.now() - start;
        logger.debug(`${operation} took ${duration}ms`);
    }
}

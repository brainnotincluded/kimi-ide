// @ts-nocheck
/**
 * Trench CLI Integration for Kimi IDE
 * Provides IPC handlers and service for Trench commands
 */

import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';

// Trench CLI command types
export type TrenchCommand = 'search' | 'research' | 'code' | 'papers' | 'archive';

// Interface for Trench options
export interface TrenchOptions {
  query: string;
  limit?: number;
  timeout?: number;
  outputFormat?: 'json' | 'markdown' | 'text';
  additionalArgs?: string[];
}

// Interface for Trench result
export interface TrenchResult {
  success: boolean;
  data?: any;
  error?: string;
  stdout?: string;
  stderr?: string;
}

/**
 * TrenchService - Service class for managing Trench CLI interactions
 */
export class TrenchService {
  private static instance: TrenchService;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private cliPath: string;

  private constructor() {
    // Determine trench CLI path based on platform
    this.cliPath = this.detectTrenchPath();
    this.setupIPCHandlers();
  }

  static getInstance(): TrenchService {
    if (!TrenchService.instance) {
      TrenchService.instance = new TrenchService();
    }
    return TrenchService.instance;
  }

  /**
   * Detect Trench CLI installation path
   */
  private detectTrenchPath(): string {
    const platform = os.platform();
    const possiblePaths: string[] = [];

    if (platform === 'darwin' || platform === 'linux') {
      possiblePaths.push(
        '/usr/local/bin/trench',
        '/usr/bin/trench',
        path.join(os.homedir(), '.local/bin/trench'),
        path.join(os.homedir(), '.cargo/bin/trench'),
        'trench' // fallback to PATH
      );
    } else if (platform === 'win32') {
      possiblePaths.push(
        'C:\\Program Files\\trench\\trench.exe',
        path.join(os.homedir(), 'AppData\\Local\\trench\\trench.exe'),
        'trench.exe'
      );
    }

    // Return first found or default to 'trench'
    return possiblePaths[0] || 'trench';
  }

  /**
   * Setup all IPC handlers for Trench commands
   */
  private setupIPCHandlers(): void {
    // Search command
    ipcMain.handle('trench:search', async (_, options: TrenchOptions) => {
      return this.executeCommand('search', options);
    });

    // Research command
    ipcMain.handle('trench:research', async (_, options: TrenchOptions) => {
      return this.executeCommand('research', options);
    });

    // Code search command
    ipcMain.handle('trench:code', async (_, options: TrenchOptions) => {
      return this.executeCommand('code', options);
    });

    // Papers search command
    ipcMain.handle('trench:papers', async (_, options: TrenchOptions) => {
      return this.executeCommand('papers', options);
    });

    // Archive command
    ipcMain.handle('trench:archive', async (_, options: TrenchOptions) => {
      return this.executeCommand('archive', options);
    });

    // Cancel active command
    ipcMain.handle('trench:cancel', async (_, commandId: string) => {
      return this.cancelCommand(commandId);
    });

    // Check trench availability
    ipcMain.handle('trench:check', async () => {
      return this.checkAvailability();
    });
  }

  /**
   * Execute a Trench CLI command
   */
  private async executeCommand(
    command: TrenchCommand,
    options: TrenchOptions
  ): Promise<TrenchResult> {
    const args = this.buildArgs(command, options);
    const commandId = `${command}_${Date.now()}`;

    return new Promise((resolve) => {
      try {
        const ptyProcess = spawn(this.cliPath, args, {
          cwd: options.additionalArgs?.find(arg => !arg.startsWith('--')) || process.cwd(),
          env: { ...process.env, FORCE_COLOR: '0' }
        });

        this.activeProcesses.set(commandId, process);

        let stdout = '';
        let stderr = '';

        ptyProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
          // Send progress updates to renderer
          this.sendProgress(commandId, data.toString());
        });

        ptyProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        ptyProcess.on('close', (code) => {
          this.activeProcesses.delete(commandId);

          if (code === 0) {
            resolve({
              success: true,
              stdout,
              stderr,
              data: this.parseOutput(stdout, options.outputFormat)
            });
          } else {
            resolve({
              success: false,
              error: `Command failed with exit code ${code}`,
              stdout,
              stderr
            });
          }
        });

        ptyProcess.on('error', (error) => {
          this.activeProcesses.delete(commandId);
          resolve({
            success: false,
            error: `Failed to execute trench: ${error.message}`,
            stderr: error.message
          });
        });

        // Timeout handling
        const timeout = options.timeout || 300000; // 5 minutes default
        setTimeout(() => {
          if (this.activeProcesses.has(commandId)) {
            process.kill('SIGTERM');
            this.activeProcesses.delete(commandId);
            resolve({
              success: false,
              error: 'Command timed out',
              stdout,
              stderr
            });
          }
        }, timeout);
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to spawn trench process: ${(error as Error).message}`
        });
      }
    });
  }

  /**
   * Build CLI arguments for trench command
   */
  private buildArgs(command: TrenchCommand, options: TrenchOptions): string[] {
    const args: string[] = [command];

    // Add query
    args.push(options.query);

    // Add limit if specified
    if (options.limit && options.limit > 0) {
      args.push('--limit', options.limit.toString());
    }

    // Add output format
    if (options.outputFormat === 'json') {
      args.push('--json');
    } else if (options.outputFormat === 'markdown') {
      args.push('--markdown');
    }

    // Add any additional arguments
    if (options.additionalArgs) {
      args.push(...options.additionalArgs.filter(arg => !arg.startsWith('--cwd')));
    }

    return args;
  }

  /**
   * Parse command output based on format
   */
  private parseOutput(stdout: string, format?: string): any {
    if (format === 'json') {
      try {
        return JSON.parse(stdout);
      } catch {
        return { raw: stdout };
      }
    }
    return { raw: stdout };
  }

  /**
   * Send progress update to renderer process
   */
  private sendProgress(commandId: string, data: string): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('trench:progress', { commandId, data });
    });
  }

  /**
   * Cancel an active command
   */
  private async cancelCommand(commandId: string): Promise<boolean> {
    const ptyProcess = this.activeProcesses.get(commandId);
    if (process) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(commandId);
      return true;
    }
    return false;
  }

  /**
   * Check if Trench CLI is available
   */
  private async checkAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    return new Promise((resolve) => {
      const ptyProcess = spawn(this.cliPath, ['--version'], { timeout: 5000 });

      let stdout = '';
      let stderr = '';

      ptyProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      ptyProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      ptyProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            available: true,
            version: stdout.trim() || stderr.trim()
          });
        } else {
          resolve({
            available: false,
            error: `Trench CLI not found or not working (exit code: ${code})`
          });
        }
      });

      ptyProcess.on('error', () => {
        resolve({
          available: false,
          error: 'Trench CLI not found in PATH'
        });
      });
    });
  }

  /**
   * Get list of active commands
   */
  getActiveCommands(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Cleanup all active processes
   */
  cleanup(): void {
    this.activeProcesses.forEach((process, id) => {
      try {
        process.kill('SIGTERM');
      } catch {
        // Ignore errors during cleanup
      }
    });
    this.activeProcesses.clear();
  }
}

// Export singleton instance
export const trenchService = TrenchService.getInstance();

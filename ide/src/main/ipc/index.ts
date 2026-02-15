/**
 * @fileoverview Main process IPC handlers barrel export
 * @module main/ipc
 */

import { ipcMain, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Store main window reference for IPC handlers
let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Send a message to the renderer process
 */
export function sendToRenderer(channel: string, data?: unknown, ...additionalArgs: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data, ...additionalArgs);
  }
}

// Import and register all IPC handlers
export function registerIPCHandlers(): void {
  // Workspace handlers
  registerWorkspaceHandlers();
  
  // Dialog handlers
  registerDialogHandlers();
  
  // Terminal handlers
  registerTerminalHandlers();
  
  // Output handlers
  registerOutputHandlers();
  
  // Problem handlers
  registerProblemHandlers();
  
  // Debug handlers
  registerDebugHandlers();
  
  // Utility handlers
  registerUtilityHandlers();
}

// ============================================================================
// Workspace IPC Handlers
// ============================================================================

function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:readFile', async (_, filePath: string): Promise<string> => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  ipcMain.handle('workspace:writeFile', async (_, filePath: string, content: string): Promise<void> => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    try {
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  ipcMain.handle('workspace:readDirectory', async (_, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') {
      throw new Error('Invalid directory path');
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory()
        }))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch (error) {
      throw new Error(`Failed to read directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  ipcMain.handle('workspace:createFile', async (_, filePath: string): Promise<void> => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, '', 'utf-8');
    } catch (error) {
      throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  ipcMain.handle('workspace:deleteFile', async (_, filePath: string): Promise<void> => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path');
    }

    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) {
        await fs.promises.rmdir(filePath, { recursive: true });
      } else {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

// ============================================================================
// Dialog IPC Handlers
// ============================================================================

function registerDialogHandlers(): void {
  ipcMain.handle('dialog:openFolder', async (): Promise<string | null> => {
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    return result.canceled ? null : result.filePaths[0];
  });
}

// ============================================================================
// Terminal IPC Handlers
// ============================================================================

import * as pty from 'node-pty';
import * as os from 'os';

const terminals = new Map<string, pty.IPty>();

function registerTerminalHandlers(): void {
  ipcMain.handle('terminal:create', (event, id: string, cwd?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return { success: false, error: 'No window found' };
    }

    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }

    try {
      const shell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh';
      const homeDir = process.env.HOME || '/';
      
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cwd || homeDir,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      });

      ptyProcess.onData((data) => {
        if (!window.isDestroyed()) {
          window.webContents.send(`terminal:data:${id}`, data);
        }
      });

      ptyProcess.onExit(() => {
        terminals.delete(id);
        if (!window.isDestroyed()) {
          window.webContents.send(`terminal:exit:${id}`);
        }
      });

      terminals.set(id, ptyProcess);
      return { success: true, pid: ptyProcess.pid };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('terminal:write', (_, id: string, data: string) => {
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }

    if (typeof data !== 'string') {
      return { success: false, error: 'Data must be a string' };
    }

    const terminal = terminals.get(id);
    if (terminal) {
      terminal.write(data);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });

  ipcMain.handle('terminal:resize', (_, id: string, cols: number, rows: number) => {
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }

    if (typeof cols !== 'number' || typeof rows !== 'number') {
      return { success: false, error: 'Invalid dimensions' };
    }

    const terminal = terminals.get(id);
    if (terminal) {
      terminal.resize(cols, rows);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });

  ipcMain.handle('terminal:kill', (_, id: string) => {
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Invalid terminal ID' };
    }

    const terminal = terminals.get(id);
    if (terminal) {
      terminal.kill();
      terminals.delete(id);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });
}

// Export for cleanup
export function cleanupTerminals(): void {
  terminals.forEach((ptyProcess) => ptyProcess.kill());
  terminals.clear();
}

// ============================================================================
// Output IPC Handlers
// ============================================================================

const outputChannels = new Map<string, string[]>();

function registerOutputHandlers(): void {
  ipcMain.handle('output:append', (_, channel: string, data: string) => {
    if (!channel || typeof channel !== 'string') {
      return { success: false };
    }

    if (!outputChannels.has(channel)) {
      outputChannels.set(channel, []);
    }
    
    const channelData = outputChannels.get(channel);
    if (channelData) {
      channelData.push(data);
    }
    
    sendToRenderer(`output:data:${channel}`, data);
    return { success: true };
  });

  ipcMain.handle('output:clear', (_, channel: string) => {
    if (!channel || typeof channel !== 'string') {
      return { success: false };
    }

    outputChannels.set(channel, []);
    sendToRenderer(`output:clear:${channel}`);
    return { success: true };
  });

  ipcMain.handle('output:get', (_, channel: string): string[] => {
    if (!channel || typeof channel !== 'string') {
      return [];
    }

    return outputChannels.get(channel) || [];
  });
}

// ============================================================================
// Problem IPC Handlers
// ============================================================================

import type { Problem } from '../../shared/types';

const problems = new Map<string, Problem[]>();

function registerProblemHandlers(): void {
  ipcMain.handle('problems:update', (_, filePath: string, fileProblems: Problem[]) => {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false };
    }

    if (!Array.isArray(fileProblems)) {
      return { success: false };
    }

    problems.set(filePath, fileProblems);
    const allProblems = Array.from(problems.values()).flat();
    sendToRenderer('problems:updated', allProblems);
    return { success: true };
  });

  ipcMain.handle('problems:getAll', (): Problem[] => {
    return Array.from(problems.values()).flat();
  });

  ipcMain.handle('problems:clear', () => {
    problems.clear();
    sendToRenderer('problems:updated', []);
    return { success: true };
  });
}

// ============================================================================
// Debug IPC Handlers
// ============================================================================

function registerDebugHandlers(): void {
  ipcMain.handle('debug:console', (_, message: string, type: 'log' | 'error' | 'warn' = 'log') => {
    if (!message || typeof message !== 'string') {
      return { success: false };
    }

    sendToRenderer('debug:console:message', { message, type, timestamp: Date.now() });
    return { success: true };
  });
}

// ============================================================================
// Utility IPC Handlers
// ============================================================================

function registerUtilityHandlers(): void {
  ipcMain.handle('file:open', async (_, filePath: string, line?: number) => {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false };
    }

    sendToRenderer('file:open', filePath, line);
    return { success: true };
  });

  ipcMain.handle('search:query', async (_, query: string) => {
    if (!query || typeof query !== 'string') {
      return { success: false };
    }

    sendToRenderer('search:query', query);
    return { success: true };
  });
}

// Re-export types
export type { Problem } from '../../shared/types';

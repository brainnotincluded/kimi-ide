/**
 * @fileoverview Main Electron process entry point
 * 
 * This module initializes the Electron application, creates the main window,
 * and sets up IPC communication handlers.
 * 
 * @module main
 */

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as pty from 'node-pty';
import * as os from 'os';

// Import tool handlers
import './toolHandlers';

// Set app name
app.setName('Kimi IDE');


/** Main application window instance */
let mainWindow: BrowserWindow | null = null;

/** Map of active terminal PTY processes */
const terminals = new Map<string, pty.IPty>();

/** Map of output channels for the output panel */
const outputChannels = new Map<string, string[]>();

/** Map of problems for the problems panel */
const problems = new Map<string, Problem[]>();

/** Supported problem severity levels */
type ProblemSeverity = 'error' | 'warning' | 'info';

/**
 * Represents a problem/diagnostic in a file
 */
interface Problem {
  /** Absolute path to the file */
  file: string;
  
  /** Line number (1-based) */
  line: number;
  
  /** Column number (optional, 1-based) */
  column?: number;
  
  /** Severity level */
  severity: ProblemSeverity;
  
  /** Problem message */
  message: string;
  
  /** Source of the problem (e.g., 'eslint', 'typescript') */
  source?: string;
  
  /** Error code (if applicable) */
  code?: string;
}

/**
 * Creates the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    // Cleanup terminals
    terminals.forEach((ptyProcess) => ptyProcess.kill());
    terminals.clear();
    mainWindow = null;
  });

  createMenu();
}

/**
 * Creates the application menu
 */
function createMenu(): void {
  const isMac = process.platform === 'darwin';
  
  const macAppMenu: Electron.MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { label: `About ${app.name}`, click: () => sendToRenderer('menu:about') },
      { type: 'separator' },
      { label: `Hide ${app.name}`, accelerator: 'Cmd+H', role: 'hide' },
      { label: 'Hide Others', accelerator: 'Cmd+Alt+H', role: 'hideOthers' },
      { type: 'separator' },
      { label: `Quit ${app.name}`, accelerator: 'Cmd+Q', click: () => app.quit() }
    ]
  };
  
  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS App Menu
    ...(isMac ? [macAppMenu] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder', accelerator: 'Cmd+O', click: openFolder }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'Cmd+B', click: () => sendToRenderer('menu:toggle-sidebar') },
        { label: 'Toggle Terminal', accelerator: 'Cmd+J', click: () => sendToRenderer('menu:toggle-terminal') },
        { type: 'separator' },
        { label: 'Toggle Problems', accelerator: 'Cmd+Shift+M', click: () => sendToRenderer('menu:toggle-problems') },
        { label: 'Toggle Output', accelerator: 'Cmd+Shift+U', click: () => sendToRenderer('menu:toggle-output') },
        { type: 'separator' },
        { label: 'Command Palette', accelerator: 'Cmd+Shift+P', click: () => sendToRenderer('menu:command-palette') }
      ]
    },
    {
      label: 'Terminal',
      submenu: [
        { label: 'New Terminal', accelerator: 'Ctrl+`', click: () => sendToRenderer('terminal:new') },
        { label: 'Kill Terminal', click: () => sendToRenderer('terminal:kill') },
        { type: 'separator' },
        { label: 'Clear Terminal', click: () => sendToRenderer('terminal:clear') }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Sends a message to the renderer process
 * @param channel - IPC channel name
 * @param data - Data to send
 * @param additionalArgs - Additional arguments
 */
function sendToRenderer(channel: string, data?: unknown, ...additionalArgs: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data, ...additionalArgs);
  }
}

/**
 * Opens a folder dialog and notifies the renderer
 */
async function openFolder(): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    sendToRenderer('folder:opened', result.filePaths[0]);
  }
}

// ============================================================================
// IPC Handlers
// ============================================================================

/**
 * Shows folder dialog and returns selected path
 */
ipcMain.handle('dialog:openFolder', async (): Promise<string | null> => {
  if (!mainWindow) {
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  return result.canceled ? null : result.filePaths[0];
});

/**
 * Reads file content
 * Note: Path validation should be performed by the caller
 */
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

/**
 * Writes content to file
 * Note: Path validation should be performed by the caller
 */
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

/**
 * Directory entry information
 */
interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

/**
 * Reads directory contents
 */
ipcMain.handle('workspace:readDirectory', async (_, dirPath: string): Promise<DirectoryEntry[]> => {
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

// ============================================================================
// Terminal PTY Handlers
// ============================================================================

/**
 * Creates a new terminal PTY instance
 */
ipcMain.handle('terminal:create', (event, id: string, cwd?: string): { success: boolean; pid?: number; error?: string } => {
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

/**
 * Writes data to a terminal
 */
ipcMain.handle('terminal:write', (_, id: string, data: string): { success: boolean; error?: string } => {
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

/**
 * Resizes a terminal
 */
ipcMain.handle('terminal:resize', (_, id: string, cols: number, rows: number): { success: boolean; error?: string } => {
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

/**
 * Kills a terminal process
 */
ipcMain.handle('terminal:kill', (_, id: string): { success: boolean; error?: string } => {
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

// ============================================================================
// Output Panel Handlers
// ============================================================================

/**
 * Appends data to an output channel
 */
ipcMain.handle('output:append', (_, channel: string, data: string): { success: boolean } => {
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

/**
 * Clears an output channel
 */
ipcMain.handle('output:clear', (_, channel: string): { success: boolean } => {
  if (!channel || typeof channel !== 'string') {
    return { success: false };
  }

  outputChannels.set(channel, []);
  sendToRenderer(`output:clear:${channel}`);
  return { success: true };
});

/**
 * Gets all data from an output channel
 */
ipcMain.handle('output:get', (_, channel: string): string[] => {
  if (!channel || typeof channel !== 'string') {
    return [];
  }

  return outputChannels.get(channel) || [];
});

// ============================================================================
// Problems Panel Handlers
// ============================================================================

/**
 * Updates problems for a file
 */
ipcMain.handle('problems:update', (_, filePath: string, fileProblems: Problem[]): { success: boolean } => {
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

/**
 * Gets all problems
 */
ipcMain.handle('problems:getAll', (): Problem[] => {
  return Array.from(problems.values()).flat();
});

/**
 * Clears all problems
 */
ipcMain.handle('problems:clear', (): { success: boolean } => {
  problems.clear();
  sendToRenderer('problems:updated', []);
  return { success: true };
});

// ============================================================================
// Debug Console Handlers
// ============================================================================

/**
 * Sends a message to the debug console
 */
ipcMain.handle('debug:console', (_, message: string, type: 'log' | 'error' | 'warn' = 'log'): { success: boolean } => {
  if (!message || typeof message !== 'string') {
    return { success: false };
  }

  sendToRenderer('debug:console:message', { message, type, timestamp: Date.now() });
  return { success: true };
});

// ============================================================================
// Utility Handlers
// ============================================================================

/**
 * Notifies renderer to open a file
 */
ipcMain.handle('file:open', async (_, filePath: string, line?: number): Promise<{ success: boolean }> => {
  if (!filePath || typeof filePath !== 'string') {
    return { success: false };
  }

  sendToRenderer('file:open', filePath, line);
  return { success: true };
});

/**
 * Sends search query to renderer
 */
ipcMain.handle('search:query', async (_, query: string): Promise<{ success: boolean }> => {
  if (!query || typeof query !== 'string') {
    return { success: false };
  }

  sendToRenderer('search:query', query);
  return { success: true };
});

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * @fileoverview Main window management
 * @module main/window
 */

import { BrowserWindow } from 'electron';
import * as path from 'path';

/** Main application window instance */
let mainWindow: BrowserWindow | null = null;

export interface WindowOptions {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  show?: boolean;
}

const DEFAULT_OPTIONS: Required<WindowOptions> = {
  width: 1400,
  height: 900,
  minWidth: 800,
  minHeight: 600,
  show: false,
};

/**
 * Creates the main application window
 */
export function createWindow(options: WindowOptions = {}): BrowserWindow {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  mainWindow = new BrowserWindow({
    width: opts.width,
    height: opts.height,
    minWidth: opts.minWidth,
    minHeight: opts.minHeight,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    show: opts.show
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Gets the main window instance
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Checks if main window exists and is not destroyed
 */
export function isWindowReady(): boolean {
  return mainWindow !== null && !mainWindow.isDestroyed();
}

/**
 * Sends a message to the renderer process
 */
export function sendToRenderer(channel: string, data?: unknown, ...additionalArgs: unknown[]): void {
  if (isWindowReady()) {
    mainWindow!.webContents.send(channel, data, ...additionalArgs);
  }
}

/**
 * Focuses the main window
 */
export function focusWindow(): void {
  if (isWindowReady()) {
    if (mainWindow!.isMinimized()) {
      mainWindow!.restore();
    }
    mainWindow!.focus();
  }
}
